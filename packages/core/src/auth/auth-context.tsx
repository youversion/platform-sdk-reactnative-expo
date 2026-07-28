import { createContext } from 'react'
import type { RequestPermissionResult } from './data-exchange'
import type { AuthPermission, YVUserInfo } from './types'

export type AuthContextValue = {
  isAuthenticated: boolean
  accessToken: string | null
  userInfo: YVUserInfo | null
  /**
   * What this device believes the signed-in user granted, scoped to that user.
   *
   * `null` means **unknown** — signed out, or signed in with nothing recorded —
   * and is deliberately distinct from `[]` ("we asked and were granted nothing").
   * Optimistic: it is seeded from what was *requested* at sign-in and corrected
   * by the server, so a 401/403 on a write is still the ultimate check.
   */
  grantedPermissions: AuthPermission[] | null
  hasPermission: (permission: AuthPermission) => boolean
  /**
   * Just-in-time grant for a permission the user denied at sign-in, or one the
   * app started requesting later. Opens the hosted consent page in an auth
   * browser session and records what comes back.
   */
  requestPermission: (permission: AuthPermission) => Promise<RequestPermissionResult>
  error: Error | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  refreshNow: () => Promise<void>
  isLoading: boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)
