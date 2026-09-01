import { createContext } from 'react'
import type { FetchBibleContent } from './bible-content/client'
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
  /** Performs Bible content requests natively (ADR 0020). */
  fetchBibleContent: FetchBibleContent
  authRedirectUrl?: string
  /** Test seam: return stub hook results without fetching. */
  hookOverrides?: HookOverrides
  /** Version filter: unset = no restriction; `[]` = permit nothing. See web SDK version filter. */
  permittedVersionIds?: number[]
  /** Version filter: excluded version ids win over permits. */
  excludedVersionIds?: number[]
  /** Version filter: BCP 47 language tags (e.g. `en`, `zh-Hans`). */
  permittedLanguageTags?: string[]
}

export const YouVersionContext = createContext<YouVersionContextValue | null>(null)
