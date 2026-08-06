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
  highlightsCacheKey,
  MMKV_HIGHLIGHTS_KEY_PREFIX,
  setCachedHighlights,
  type ExpandedPassageId,
  type HighlightScope,
  type ServerColors,
} from './cache'

export { HIGHLIGHT_COLORS, isHighlightColor, type HighlightColor } from './constants'

export {
  clearHighlightQueue,
  getHighlightQueueSnapshot,
  hasPendingHighlightOperations,
  MMKV_HIGHLIGHT_QUEUE_KEY_PREFIX,
  subscribeHighlightQueue,
  type HighlightQueueSnapshot,
  type PendingOp,
} from './queue'

export {
  useHighlights,
  type HighlightsFetchError,
  type HighlightWriteOutcome,
  type HighlightWriteReason,
  type UseHighlightsOptions,
  type UseHighlightsResult,
} from './use-highlights'
