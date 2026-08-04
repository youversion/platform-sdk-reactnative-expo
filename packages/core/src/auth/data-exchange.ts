import { buildDataExchangeUrl, parseDataExchangeCallback } from '@youversion/platform-core'
import * as WebBrowser from 'expo-web-browser'

import { toMessage } from '../error-message'
import type { DataExchangeApi, DataExchangeError } from './data-exchange-api'
import {
  loadCachedGrantedPermissions,
  mergeGrantedPermissions,
  saveGrantedPermissions,
} from './granted-permissions-cache'
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
 * See docs/adr/0015-data-exchange-return-scheme.md.
 */
export const DATA_EXCHANGE_RETURN_URL = 'youversionauth://callback'

/**
 * Why a request failed. The distinction that matters to a caller is whether
 * retrying can help, and when.
 *
 * - `not-signed-in` / `not-permitted` — retrying changes nothing. Sign the user
 *   in, or fix the app key in the console.
 * - `user-changed` — the grant was discarded because the signed-in user moved.
 *   Ask again as the new user.
 * - `in-progress` — another request holds the flow. Retry once it settles, not
 *   before: a retry now hits this same branch, because only one consent page can
 *   be open at a time.
 * - `transient` — a network blip, a 5xx, a schema failure. Retry immediately.
 */
export type DataExchangeFailureReason =
  | 'not-signed-in'
  | 'not-permitted'
  | 'user-changed'
  | 'in-progress'
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
 * `userId` comes from the id_token's `sub` and can legitimately be absent, so
 * `null` means both "signed in, no id" and "signed out". `sessionId`
 * disambiguates them: a local counter, compared only for equality and
 * meaningless as a value, that changes on every sign-in and sign-out and *only*
 * on those. It deliberately does not change on a token refresh — a new token
 * for the same person must not fail the flow.
 */
export type AuthIdentity = {
  sessionId: number
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
 * `api` and `getCurrentIdentity` are injected so the flow is unit-testable
 * without React and without constructing an `ApiClient` on every call site.
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
      message: toMessage(caught),
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

  // Initiator guard, fail closed: if the signed-in user is not the one who
  // started this flow, discard the grant and let them ask again.
  //
  // Be honest about what this is worth. It is a cheap backstop, not a defence
  // against anything a user can do — neither platform lets them reach the app
  // while the consent page is up. iOS presents a modal sheet; on Android the
  // Custom Tab is a separate task the user *can* leave, but foregrounding the
  // app resolves the auth session as `dismiss` first, so the flow is already
  // over. What can still land mid-flow is not user-driven: a revoked refresh
  // token tripping `clearAuthState`, or app code calling `signOut` from a timer
  // or push handler. Both end signed out, and a signed-out write is already a
  // no-op — `saveGrantedPermissions` refuses a null userId.
  //
  // So the guard earns its keep on two narrower points. The reported outcome
  // must never say `granted` for a user who has left, since that is the API
  // consumers branch on. And this function stays correct on its own terms
  // rather than by depending on a null check in granted-permissions-cache.ts
  // that nothing here links to — the coupling that breaks the day someone adds
  // a device-scoped fallback to the cache.
  //
  // Compare identity, not tokens: a mid-flow refresh issues a new token for the
  // same person and must pass. A same-session id-less user passes too, which is
  // deliberate — `sub` can legitimately be absent, and failing closed there
  // would make the flow permanently unusable for those users.
  const current = getCurrentIdentity()
  if (current.sessionId !== initiator.sessionId || current.userId !== initiator.userId) {
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
