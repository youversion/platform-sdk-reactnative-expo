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
   *
   * **Seeded ahead of session validation.** The provider restores this from its
   * per-user cache in a `useState` initializer, so on the first render it is
   * populated while `accessToken` is still `null` and `isLoading` is `true` —
   * the same cold-start behaviour `userInfo` already has. Bootstrap may then
   * revoke the session. Callers gating real work on a permission must therefore
   * check `isAuthenticated` / `isLoading` too; a grant alone does not mean there
   * is a live session behind it.
   */
  grantedPermissions: readonly string[] | null
  /**
   * Whether `permission` is in {@link grantedPermissions}. False when unknown.
   *
   * Narrows to the known {@link AuthPermission} union by design, even though
   * {@link grantedPermissions} deliberately keeps unrecognized values verbatim —
   * that way a later union widening finds the cached grant already correct. To
   * query a value not yet in the union, read `grantedPermissions` directly.
   *
   * Carries the same seeded-before-validation caveat as {@link grantedPermissions}.
   */
  hasPermission: (permission: AuthPermission) => boolean
  /** Drop a stale cached grant (e.g. after a 401/403 write) so the next pre-flight re-prompts. */
  invalidatePermissions: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
