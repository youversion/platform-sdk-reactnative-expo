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
   * Advisory — the server remains the enforcement point (see
   * `docs/adr/0014-cached-grant-is-a-hint.md`).
   */
  hasPermission: (permission: AuthPermission) => boolean
  /** Drop a stale cached grant (e.g. after a 401/403 write) so the next pre-flight re-prompts. */
  invalidatePermissions: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
