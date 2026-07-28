import {
  ApiClient,
  buildDataExchangeUrl,
  DataExchangeClient,
  parseDataExchangeCallback,
} from '@youversion/platform-core'
import * as WebBrowser from 'expo-web-browser'

import { getOrSetInstallationId } from '../installation-id'
import type { AuthPermission } from './types'

/**
 * The outcome of a just-in-time permission grant.
 *
 * `granted` means **the exchange completed**, not that the permission you asked
 * for is in it: the hosted page answers with everything it granted, which can be
 * a subset of the request (or empty) when the user unticks something. Callers
 * that need "did I get `highlights`?" must read {@link RequestPermissionResult}'s
 * `permissions`, or `hasPermission` after the provider has persisted it.
 */
export type RequestPermissionResult =
  | { kind: 'granted'; permissions: AuthPermission[] }
  | { kind: 'cancel' }
  | { kind: 'failure'; message: string }

export type RequestPermissionViaDataExchangeProps = {
  apiHost: string
  appKey: string
  /** The signed-in user's access token. The exchange mints its own short-lived one from it. */
  accessToken: string
  /** Same redirect the PKCE flow uses; the hosted page returns to it. */
  redirectUri: string
  permissions: readonly AuthPermission[]
  /**
   * The signed-in user at the moment the flow starts, captured by the caller
   * before the browser session opens. `null` fails the flow closed.
   */
  initiatorUserId: string | null
  /** Reads the CURRENTLY signed-in user, called after the session returns. */
  getCurrentUserId: () => string | null
}

const MISSING_STATUS_MESSAGE =
  'The data exchange returned without a status. No permission was granted.'
const DENIED_MESSAGE = 'The data exchange did not grant the requested permission.'
const INITIATOR_MISMATCH_MESSAGE =
  'The signed-in user changed during the data exchange. The grant was discarded.'

/**
 * YouVersion's just-in-time permission grant: mint a short-lived data-exchange
 * token, send the user to the hosted consent page in an auth browser session,
 * and read the grant off the URL it returns to.
 *
 * Lives next to `pkce-flow.ts` because it is an auth capability that highlights
 * merely happens to be the first caller of, and it reuses the same primitives —
 * `openAuthSessionAsync`, the app's registered redirect, and the installation id.
 *
 * `handleDataExchangeCallback` from `@youversion/platform-core` is deliberately
 * **not** reused: it reads `window.location` and rewrites history, neither of
 * which exists here. We parse the URL `openAuthSessionAsync` hands back instead,
 * through the same pure `parseDataExchangeCallback` it wraps.
 */
export async function requestPermissionViaDataExchange({
  apiHost,
  appKey,
  accessToken,
  redirectUri,
  permissions,
  initiatorUserId,
  getCurrentUserId,
}: RequestPermissionViaDataExchangeProps): Promise<RequestPermissionResult> {
  const redirectUriString = redirectUri.endsWith('/') ? redirectUri.slice(0, -1) : redirectUri

  let returnedUrl: string
  try {
    const installationId = await getOrSetInstallationId()
    const client = new DataExchangeClient(new ApiClient({ appKey, apiHost, installationId }))
    const token = await client.updateToken([...permissions], accessToken)

    const result = await WebBrowser.openAuthSessionAsync(
      buildDataExchangeUrl(token, appKey, apiHost),
      redirectUriString,
    )
    if (result.type !== 'success') {
      // Dismissed the browser, or backgrounded out of it. Same as declining.
      return { kind: 'cancel' }
    }
    returnedUrl = result.url
  } catch (caught) {
    return { kind: 'failure', message: caught instanceof Error ? caught.message : String(caught) }
  }

  const callback = parseDataExchangeCallback(searchOf(returnedUrl))
  if (callback === null) {
    return { kind: 'failure', message: MISSING_STATUS_MESSAGE }
  }
  if (callback.status === 'cancel') {
    return { kind: 'cancel' }
  }
  if (callback.status !== 'granted') {
    return { kind: 'failure', message: DENIED_MESSAGE }
  }

  // Fail closed on an initiator mismatch, exactly as web does. The session runs
  // over a live JS context here rather than a full-page redirect, so a user
  // switch mid-flow is far less likely — but the cost of being wrong is
  // recording a grant against an account that never consented, and the cost of
  // being over-careful is one extra prompt.
  const currentUserId = getCurrentUserId()
  if (initiatorUserId === null || currentUserId === null || currentUserId !== initiatorUserId) {
    return { kind: 'failure', message: INITIATOR_MISMATCH_MESSAGE }
  }

  return { kind: 'granted', permissions: callback.grantedPermissions }
}

/**
 * The query string of the return URL. App redirects are custom-scheme URLs
 * (`myapp://callback?...`), so this stays tolerant of anything `URL` refuses to
 * parse rather than throwing on the way to a grant we already hold.
 */
function searchOf(url: string): string {
  try {
    return new URL(url).search
  } catch {
    const index = url.indexOf('?')
    return index === -1 ? '' : url.slice(index)
  }
}
