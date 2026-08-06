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
  /**
   * There is highlight work this device has not managed to save: the durable
   * retry queue is non-empty, or a write is on the wire right now.
   *
   * Core exposes the **fact**; the UI owns the **prompt**. `YouVersionAuthButton`
   * and the reader's toolbar both warn before signing out; a host calling
   * `signOut()` itself reads this and builds its own warning rather than
   * inheriting a behaviour it cannot opt out of.
   */
  hasPendingHighlightOperations: boolean
  /**
   * Throws away every queued highlight write and invalidates anything already in
   * flight, so a result from the departed session can never land on the next
   * account.
   *
   * Discards, never flushes — matching Swift. The warning already told the user
   * the work would be lost, and flushing on a dead network hangs the sign-out
   * they just asked for. `signOut()` does this for you; call it directly only
   * when abandoning the work without signing out.
   */
  discardPendingHighlights: () => void
  error: Error | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  refreshNow: () => Promise<void>
  isLoading: boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)
