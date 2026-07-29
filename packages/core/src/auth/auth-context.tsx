import { createContext } from 'react'
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
}

export const AuthContext = createContext<AuthContextValue | null>(null)
