import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from './auth-context'

export function useYVAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (ctx === null) {
    throw new Error('useYVAuth must be used within YouVersionProvider with the `auth` prop set.')
  }
  return ctx
}
