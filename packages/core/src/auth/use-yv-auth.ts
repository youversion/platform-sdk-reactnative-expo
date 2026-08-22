import { use } from 'react'
import { YouVersionContext } from '../youversion-context'
import { AuthContext, type AuthContextValue } from './auth-context'

export function useYVAuth(): AuthContextValue {
  const yv = use(YouVersionContext)
  const ctx = use(AuthContext)
  const override = yv?.hookOverrides?.useYVAuth
  if (override !== undefined) {
    if (override === null) {
      throw new Error('useYVAuth must be used within YouVersionProvider with the `auth` prop set.')
    }
    return override
  }
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
  const yv = use(YouVersionContext)
  const ctx = use(AuthContext)
  if (yv?.hookOverrides?.useYVAuth !== undefined) {
    return yv.hookOverrides.useYVAuth
  }
  return ctx
}
