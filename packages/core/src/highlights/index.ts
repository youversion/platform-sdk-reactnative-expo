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
