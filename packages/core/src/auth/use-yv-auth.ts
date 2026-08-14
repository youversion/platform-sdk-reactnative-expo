import { use } from 'react'
import { AuthContext, type AuthContextValue } from './auth-context'

export function useYVAuth(): AuthContextValue {
  const ctx = use(AuthContext)
  if (ctx === null) {
    throw new Error('useYVAuth must be used within YouVersionProvider with the `auth` prop set.')
  }
  return ctx
}

/**
 * Like {@link useYVAuth} but returns `null` instead of throwing when `auth` is not configured.
 *
 * @internal Plumbing, not consumer API. It is what SDK-internal callers that
 * must work either way use — core's own highlights hooks and drain host, and
 * the UI package's `BibleReader`, which is the reason it leaves the package at
 * all. It may change without semver ceremony; consumers should use
 * {@link useYVAuth}.
 */
export function useYVAuthOptional(): AuthContextValue | null {
  return use(AuthContext)
}
