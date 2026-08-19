import type { AuthContextValue } from './auth/auth-context'
import type { UseHighlightPermissionFlowResult } from './highlights/use-highlight-permission-flow'
import type { UseHighlightsOptions, UseHighlightsResult } from './highlights/use-highlights'

/**
 * Test seam: skip live fetch and return stub hook results.
 * Production providers leave this unset.
 */
export type HookOverrides = {
  useYVAuth?: AuthContextValue | null
  useHighlights?: (options: UseHighlightsOptions) => UseHighlightsResult
  useHighlightPermissionFlow?: (options: UseHighlightsOptions) => UseHighlightPermissionFlowResult
}
