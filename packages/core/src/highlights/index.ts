export {
  createHighlightsApi,
  type Collection,
  type CreateHighlight,
  type CreateHighlightsApiConfig,
  type DeleteHighlightOptions,
  type GetHighlightsOptions,
  type Highlight,
  type HighlightsApi,
  type HighlightsApiError,
  type HighlightsApiResult,
} from './api'

export {
  clearHighlightsCache,
  deriveServerColors,
  expandPassageId,
  getCachedHighlights,
  parseChapterScopeFromUsfm,
  highlightsCacheKey,
  MMKV_HIGHLIGHTS_KEY_PREFIX,
  setCachedHighlights,
  type ExpandedPassageId,
  type HighlightScope,
  type ServerColors,
} from './cache'

export { HIGHLIGHT_COLORS, isHighlightColor, mixSrgb, type HighlightColor } from './constants'
export { isValidHighlightHex } from './paint-projection'

// `clearHighlightQueue` is sign-out's, and stays internal.
// `hasQueuedHighlightWrites` is public: the reader has to know whether signing
// out costs the user work before it can ask them about it.
export { clearHighlightQueue, hasQueuedHighlightWrites } from './queue'

// The reducer, its events, and `PendingHighlight` stay internal — the flow's
// public surface is the hook plus what a caller has to render or report.
export type { PermissionFlowError, PermissionFlowErrorReason } from './permission-flow'

export {
  useHighlightPermissionFlow,
  type UseHighlightPermissionFlowResult,
} from './use-highlight-permission-flow'

export {
  useHighlights,
  type HighlightsFetchError,
  type HighlightWriteOutcome,
  type HighlightWriteReason,
  type UseHighlightsOptions,
  type UseHighlightsResult,
} from './use-highlights'

export { useHighlightPaint } from './use-highlight-paint'
