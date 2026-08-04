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
  requestedPermissions: readonly AuthPermission[]
}

export const AuthContext = createContext<AuthContextValue | null>(null)
