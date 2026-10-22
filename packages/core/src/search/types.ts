import type {
  SearchQueries,
  SearchQuery,
  SearchTopic,
  SearchTopicsResponse,
  SearchVerseHit,
  SearchVersesResponse,
} from '@youversion/platform-core'

import type { Result } from '../result'
import type {
  SearchUnifiedField,
  SearchUnifiedOptions,
  SearchUnifiedResponse,
} from './search-unified-schema'

/**
 * Server-supplied search intent. A string wrapper, not an enum: known
 * constants live on {@link SEARCH_USER_INTENT}, and unknown values are kept.
 */
export type YouVersionSearchUserIntent = string

export const SEARCH_USER_INTENT = {
  reference: 'reference',
  text: 'text',
  topical: 'topical',
  unknown: 'unknown',
} as const

export type YouVersionSearchQuery = SearchQuery
export type YouVersionSearchQueries = SearchQueries
export type YouVersionVerseSearchResult = SearchVerseHit
export type YouVersionVerseSearchResults = SearchVersesResponse
export type YouVersionSearchTopic = SearchTopic
export type YouVersionTopicSearchResults = SearchTopicsResponse

export type YouVersionUnifiedSearchField = SearchUnifiedField

export type YouVersionUnifiedSearchResults = SearchUnifiedResponse

export type SearchApiError =
  | { kind: 'auth'; status: 401 | 403; message: string }
  | { kind: 'transient'; status?: number; message: string }
  | { kind: 'invalid-parameter'; message: string }

export type SearchApiResult<Value> = Result<Value, SearchApiError>

export type SuggestedQueriesParams = {
  query: string
  languageRanges: string[]
}

export type TrendingQueriesParams = {
  languageRanges: string[]
}

export type SearchVersesParams = {
  query: string
  bibleId: number
  userIntent?: YouVersionSearchUserIntent
  pageSize?: number
  pageToken?: string
}

export type SearchTopicsParams = {
  query: string
  languageRanges: string[]
}

export type SearchUnifiedParams = {
  query: string
  bibleId: number
  languageRanges: string[]
  fields?: SearchUnifiedOptions['fields']
  userIntent?: SearchUnifiedOptions['userIntent']
}
