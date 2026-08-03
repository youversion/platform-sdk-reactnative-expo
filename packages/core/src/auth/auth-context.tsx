import { createContext } from 'react'
import type { DataExchangeOutcome } from './data-exchange'
import type { AuthPermission, YVUserInfo } from './types'

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
   * Cheap to await on every user gesture — unlike {@link refreshNow}, which
   * always hits the token endpoint.
   *
   * Exists so a permission pre-flight cannot misread an expired token as a
   * missing permission (Swift's `hasValidToken()` parity). It never throws: a
   * failed refresh surfaces through {@link error}, exactly as the periodic
   * refresh does.
   *
   * Caveat, and it is load-bearing: this resolves immediately when a refresh is
   * already in flight rather than joining it, so it does not *guarantee* a fresh
   * token — see `.claude/bugs/auth-provider-expired-access-token.md` (failure
   * mode 2). Callers still need a corrective path for a 401.
   */
  ensureFreshToken: () => Promise<void>
  isLoading: boolean
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
