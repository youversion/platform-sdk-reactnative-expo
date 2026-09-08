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

export type YouVersionSearchQuery = {
  text: string
  source?: string
}

export type YouVersionVerseSearchResult = {
  reference: string
}

export type YouVersionVerseSearchResults = {
  verses: YouVersionVerseSearchResult[]
  userIntent?: YouVersionSearchUserIntent
  didYouMean: string[]
  searchInsteadFor?: string
  nextPageToken?: string
}

export type YouVersionSearchTopic = {
  id?: number
  text: string
  subtopics: string[]
}

export type YouVersionTopicSearchResults = {
  topics: YouVersionSearchTopic[]
  didYouMean: string[]
  searchInsteadFor?: string
  totalSize: number
}

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
  verse: number
}
