import { createContext } from 'react'
import type { HookOverrides } from './hook-overrides'

/**
 * The core provider's context value, and the return type of `useYouVersion()`.
 *
 * @internal Plumbing, not consumer API. It is exported only so the type is
 * nameable across the package boundary; every field on it is provider
 * configuration the SDK's own components read. It may change without semver
 * ceremony — consumers should let `useYouVersion()` infer it.
 */
export type YouVersionContextValue = {
  appKey: string
  apiHost: string
  installationId: string
  authRedirectUrl?: string
  /** Test seam: return stub hook results without fetching. */
  hookOverrides?: HookOverrides
}

export const YouVersionContext = createContext<YouVersionContextValue | null>(null)
