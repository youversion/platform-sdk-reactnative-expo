import { buildDataExchangeUrl, parseDataExchangeCallback } from '@youversion/platform-core'
import * as WebBrowser from 'expo-web-browser'

import type { DataExchangeApi, DataExchangeError } from './data-exchange-api'
import {
  loadCachedGrantedPermissions,
  mergeGrantedPermissions,
  saveGrantedPermissions,
} from './granted-permissions'
import type { AuthPermission } from './types'

/**
 * Where the hosted consent page returns to. Hardcoded and SDK-owned, matching
 * the Swift SDK's `callbackURLScheme` — it is **not** the app's OAuth
 * `redirectUri`, and `buildDataExchangeUrl` takes no redirect param because the
 * server already knows this value.
 *
 * iOS needs nothing extra (`ASWebAuthenticationSession` intercepts the scheme at
 * call time). Android resolves the auth session through a real deep link, so the
 * consuming app must register `youversionauth` in its `app.json` `scheme` —
 * without it the flow hangs until the user dismisses it and reports `cancel`.
 * See docs/adr/0014-data-exchange-return-scheme.md.
 */
export const DATA_EXCHANGE_RETURN_URL = 'youversionauth://callback'

export type DataExchangeFailureReason =
  | 'not-signed-in'
  | 'not-permitted'
  | 'user-changed'
  | 'transient'

/**
 * What a permission request resolved to.
 *
 * `granted` carries the permissions the server reported, which is not
 * necessarily everything that was asked for — check the list rather than the
 * status when you need one specific permission.
 */
export type DataExchangeOutcome =
  | { status: 'granted'; grantedPermissions: string[] }
  | { status: 'cancel' }
  | { status: 'failure'; reason: DataExchangeFailureReason; message: string }

/**
 * Who is signed in, for the initiator guard.
 *
 * `userId` alone cannot answer the question: it comes from the id_token's `sub`
 * and can legitimately be absent, so `null` means both "signed in, no id" and
 * "signed out" — and treating those as equal lets a grant land after the user
 * has left, under an identity the next id-less user reads back.
 *
 * `epoch` closes that: it changes on every sign-in and sign-out, and *only* on
 * those, so a session change is detectable even when there is no id to compare.
 * It deliberately does not change on a token refresh — a new token for the same
 * person must not fail the flow.
 */
export type AuthIdentity = {
  epoch: number
  userId: string | null
}

export type RequestDataExchangeArgs = {
  api: DataExchangeApi
  appKey: string
  apiHost: string
  accessToken: string
  /** The initiator: identity captured by the caller *before* invoking. */
  initiator: AuthIdentity
  permissions: readonly AuthPermission[]
  /** Re-reads the current identity after the browser round-trip (initiator guard). */
  getCurrentIdentity: () => AuthIdentity
}

/**
 * Just-in-time permission grant: mint a data-exchange token, run the hosted
 * consent page in an auth session, and merge what the user granted into the
 * cached grant. Permission-generic — nothing here knows about highlights.
 *
 * Never throws, and never touches the grant cache except on a `granted` return.
 * `api` and `getCurrentUserId` are injected so the flow is unit-testable without
 * React and without constructing an `ApiClient` on every call site.
 */
export async function requestDataExchange({
  api,
  appKey,
  apiHost,
  accessToken,
  initiator,
  permissions,
  getCurrentIdentity,
}: RequestDataExchangeArgs): Promise<DataExchangeOutcome> {
  const minted = await api.mintToken(accessToken, permissions)
  if (!minted.ok) {
    return mintFailure(minted.error)
  }

  // `openAuthSessionAsync` rejects on conditions a caller can actually hit, not
  // just on programmer error: a session already open (a double-tap — "WebBrowser
  // is already open, only one can be open at a time"), a missing native module,
  // or an Android build with no activity able to handle the intent. This
  // function promises an outcome, so none of them may escape.
  let session: WebBrowser.WebBrowserAuthSessionResult
  try {
    session = await WebBrowser.openAuthSessionAsync(
      buildDataExchangeUrl(minted.value, appKey, apiHost),
      DATA_EXCHANGE_RETURN_URL,
    )
  } catch (caught) {
    return {
      status: 'failure',
      reason: 'transient',
      message: caught instanceof Error ? caught.message : String(caught),
    }
  }

  // Anything that is not a redirect back to us is a cancel: the user dismissed
  // the sheet, or — on an Android build that never registered the
  // `youversionauth` scheme — the session hung until dismissal and reported
  // `dismiss`. Neither is an error we can act on beyond letting the user retry.
  if (session.type !== 'success') {
    return { status: 'cancel' }
  }

  const callback = parseCallback(session.url)
  if (callback === null) {
    return {
      status: 'failure',
      reason: 'transient',
      message: 'Data exchange returned a URL that is not a data-exchange callback.',
    }
  }
  if (callback.status === 'cancel') {
    return { status: 'cancel' }
  }
  if (callback.status === 'failure') {
    return {
      status: 'failure',
      reason: 'transient',
      message: 'Data exchange reported a failed permission grant.',
    }
  }

  // Initiator guard, fail closed. The signed-in user can change while the
  // browser is up (a sign-out, or a sign-in as somebody else), and a grant
  // written against the wrong account is invisible and wrong; a discarded one
  // just re-prompts. Compare identity, not tokens — a mid-flow refresh issues a
  // new token for the same person and must not fail the flow.
  //
  // Both halves of {@link AuthIdentity} matter. The id alone would let an
  // id-less user's grant survive a mid-flow sign-out (`null === null`) and be
  // read back by the next id-less user; the epoch alone would not catch a
  // grant landing against a different id within one session.
  //
  // A same-epoch id-less user still passes, which is deliberate: `sub` can
  // legitimately be absent, and failing closed on that would make the flow
  // permanently unusable for those users rather than merely re-prompting.
  const current = getCurrentIdentity()
  if (current.epoch !== initiator.epoch || current.userId !== initiator.userId) {
    return {
      status: 'failure',
      reason: 'user-changed',
      message: 'The signed-in user changed during the permission grant; the grant was discarded.',
    }
  }

  // Merge, never replace: this consent only reports the permissions it asked
  // for. An empty grant is not written at all — the cache's absent state means
  // "unknown", and storing `[]` would record a denial the server never sent.
  if (callback.grantedPermissions.length > 0) {
    saveGrantedPermissions(
      current.userId,
      mergeGrantedPermissions(
        loadCachedGrantedPermissions(current.userId) ?? [],
        callback.grantedPermissions,
      ),
    )
  }

  return { status: 'granted', grantedPermissions: callback.grantedPermissions }
}

function mintFailure(error: DataExchangeError): DataExchangeOutcome {
  return {
    status: 'failure',
    reason: error.kind === 'not-permitted' ? 'not-permitted' : 'transient',
    message: error.message,
  }
}

/**
 * `parseDataExchangeCallback` is the pure parser; `handleDataExchangeCallback`
 * is the browser entry point (it reads `window.location` and writes web's own
 * permission cache), so it is deliberately not used here.
 */
function parseCallback(url: string): ReturnType<typeof parseDataExchangeCallback> {
  try {
    return parseDataExchangeCallback(new URL(url).search)
  } catch {
    // A success result always carries our return URL, so this is unreachable in
    // practice — but a throw here would escape an otherwise total function.
    return null
  }
}
