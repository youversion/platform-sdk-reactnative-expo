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
  getServerColors,
  highlightsCacheKey,
  MMKV_HIGHLIGHTS_KEY_PREFIX,
  setServerColors,
  type HighlightScope,
  type ServerColors,
} from './cache'
