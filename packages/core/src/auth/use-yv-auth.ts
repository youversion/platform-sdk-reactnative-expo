import { use } from 'react'
import { AuthContext, type AuthContextValue } from './auth-context'

export function useYVAuth(): AuthContextValue {
  const ctx = use(AuthContext)
  if (ctx === null) {
    throw new Error('useYVAuth must be used within YouVersionProvider with the `auth` prop set.')
  }
  return ctx
}

/** Like {@link useYVAuth} but returns `null` instead of throwing when `auth` is not configured. */
export function useYVAuthOptional(): AuthContextValue | null {
  return use(AuthContext)
}
