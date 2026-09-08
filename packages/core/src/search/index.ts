export { createSearchApi, type CreateSearchApiConfig, type SearchApi } from './api'
export {
  SEARCH_USER_INTENT,
  type BibleReference,
  type SearchApiError,
  type SearchApiResult,
  type SearchTopicsParams,
  type SearchVersesParams,
  type SuggestedQueriesParams,
  type TrendingQueriesParams,
  type YouVersionSearchQuery,
  type YouVersionSearchTopic,
  type YouVersionSearchUserIntent,
  type YouVersionTopicSearchResults,
  type YouVersionVerseSearchResult,
  type YouVersionVerseSearchResults,
} from './types'
export { bibleReferenceFromUsfm } from './usfm'
export { useSearch, type UseSearchResult } from './use-search'
