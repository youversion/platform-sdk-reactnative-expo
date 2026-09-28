import type {
  SearchQueries,
  SearchQuery,
  SearchTopic,
  SearchTopicsResponse,
  SearchVerseHit,
  SearchVersesResponse,
} from '@youversion/platform-core'

import type { Result } from '../result'

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

export type BibleReference = {
  versionId: number
  bookId: string
  chapter: number
  /** Absent for chapter-only hits. For ranges, the start verse (scroll anchor). */
  verse?: number
}
