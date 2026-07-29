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
   * Three-state grant: `null` = unknown / never requested, `[]` = denied,
   * populated = granted. Values outside {@link AuthPermission} are kept
   * verbatim so a server-side addition never reads as a denial.
   */
  grantedPermissions: readonly string[] | null
  /** Whether `permission` is in {@link grantedPermissions}. False when unknown. */
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
