import type { AuthContextValue } from './auth/auth-context'
import type { UseHighlightPermissionFlowResult } from './highlights/use-highlight-permission-flow'
import type { UseHighlightsOptions, UseHighlightsResult } from './highlights/use-highlights'

/**
 * Test seam: skip live fetch and return stub hook results.
 * Production providers leave this unset.
 *
 * Override wrappers still call the real hook (rules of hooks) but pass
 * `live: false` so it does not GET, write, notify the drain, or persist cache.
 */
export type HookOverrides = {
  useYVAuth?: AuthContextValue | null
  useHighlights?: (options: UseHighlightsOptions) => UseHighlightsResult
  useHighlightPermissionFlow?: (options: UseHighlightsOptions) => UseHighlightPermissionFlowResult
}
