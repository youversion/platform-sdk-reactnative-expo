export { useYouVersion } from './use-youversion'
export type { YouVersionContextValue } from './youversion-context'
export { default as YouVersionProvider } from './youversion-provider'

export { useYVAuth, useYVAuthOptional } from './auth'
export type { AuthConfig, AuthPermission, AuthScope, YVUserInfo } from './auth'

// Highlights. The API wrapper, the MMKV cache, and the `Result` seam stay
// internal — `useHighlights` is the whole public surface. `deriveServerColors`
// ships alongside it because the hook returns per-verse highlights, making
// `deriveServerColors(highlights, scope)` an exact projection to the verse→color
// map a renderer may want.
export { deriveServerColors, HIGHLIGHT_COLORS, isHighlightColor, useHighlights } from './highlights'
export type {
  Highlight,
  HighlightColor,
  HighlightScope,
  HighlightsFetchError,
  HighlightWriteOutcome,
  HighlightWriteReason,
  ServerColors,
  UseHighlightsOptions,
  UseHighlightsResult,
} from './highlights'

export { mmkvStorage } from './storage'
