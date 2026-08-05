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
