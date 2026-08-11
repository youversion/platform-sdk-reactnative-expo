import { createContext } from 'react'
import type { DataExchangeOutcome } from './data-exchange'
import type { AuthPermission, YVUserInfo } from './types'

/**
 * What {@link AuthContextValue.getAccessToken} resolves to. `refresh-failed`
 * means the token is expired and the refresh did not land (endpoint down,
 * network out) — the session itself is still intact, so treat it as transient,
 * not as signed out.
 *
 * `userId` is whose token this is, read in the same synchronous block as the
 * token itself. A caller that captured an identity earlier must compare against
 * this, not against a `userInfo` it read from a render: the provider writes both
 * refs together on sign-in, so anything reading identity through React state
 * lags the token by a render and can pass an owner check it should have failed.
 */
export type AccessTokenResult =
  | { status: 'ok'; token: string; userId: string | null }
  | { status: 'unavailable'; reason: 'signed-out' | 'refresh-failed' }

export type AuthContextValue = {
  isAuthenticated: boolean
  accessToken: string | null
  userInfo: YVUserInfo | null
  error: Error | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  refreshNow: () => Promise<void>
  /**
   * Refresh the access token **only if it is at or near expiry**, then resolve.
   * Cheap to await on every user gesture, unlike {@link refreshNow}, which always
   * hits the token endpoint.
   *
   * Exists so an expired token cannot be misread as a missing permission
   * (Swift's `hasValidToken()` parity). It never throws: a failed refresh
   * surfaces through {@link error}, exactly as the periodic refresh does.
   *
   * Await it on the **send** path, immediately before an auth-sensitive request
   * — not in front of whatever the user just tapped. When a refresh is due this
   * costs a full token round-trip, so anything optimistic should have painted
   * already. `useHighlights` is the worked example.
   *
   * A refresh already in flight is **joined**, not skipped, so once this resolves
   * the token is the current one. A failed refresh still leaves the old token in
   * place, so a caller doing something auth-sensitive wants a corrective path for
   * a 401 regardless.
   */
  ensureFreshToken: () => Promise<void>
  /**
   * Resolve a token that is verifiably fresh, or say why one is unavailable.
   * Unlike {@link ensureFreshToken}, which only performs the refresh side
   * effect, this reports whether it worked — so a caller can tell "refreshed"
   * from "still expired" and stop a doomed request before it 401s and gets
   * misread as a revoked grant.
   *
   * Leeway-gated and single-flight like {@link ensureFreshToken}: cheap when
   * the token is fresh, joins an in-flight refresh otherwise. Never rejects.
   */
  getAccessToken: () => Promise<AccessTokenResult>
  isLoading: boolean
  /**
   * What the app **asked for** on its `auth` config — never what was granted.
   * Always an array; `[]` when `auth` is unconfigured. Pairs with
   * {@link grantedPermissions}, which answers the different question.
   */
  requestedPermissions: readonly AuthPermission[]
  /**
   * Three-state grant: `null` = unknown / never requested, `[]` = requested and
   * denied, populated = granted. Unrecognized values are kept verbatim so a
   * server-side addition never reads as a denial.
   *
   * Seeded synchronously from a per-user cache, so it is populated on the first
   * render while `isLoading` is still `true` — gate real work on
   * `isAuthenticated` / `isLoading` too.
   */
  grantedPermissions: readonly string[] | null
  /**
   * Whether `permission` is in {@link grantedPermissions}; false when unknown.
   * Advisory — the server remains the enforcement point.
   */
  hasPermission: (permission: AuthPermission) => boolean
  /** Drop a stale cached grant (e.g. after a 401/403 write) so the next pre-flight re-prompts. */
  invalidatePermissions: () => void
  /**
   * Asks an already signed-in user to grant `permissions` on the spot, via
   * YouVersion's hosted consent page — no sign-out required. A `granted`
   * outcome merges into {@link grantedPermissions}, so `hasPermission` answers
   * true on the next render. Fails immediately with `not-signed-in` when there
   * is no token.
   */
  requestPermissions: (permissions: readonly AuthPermission[]) => Promise<DataExchangeOutcome>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
