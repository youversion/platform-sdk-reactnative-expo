import type {
  SearchImageHit,
  SearchQueries,
  SearchQuery,
  SearchTopic,
  SearchTopicsResponse,
  SearchUnifiedField,
  SearchImagesOptions,
  SearchImagesResponse,
  SearchUnifiedResponse,
  SearchVerseHit,
  SearchVersesResponse,
} from '@youversion/platform-core'

import type { SearchVideoHit } from '../content-library/interim/search-unified'
import type { SearchVideosOptions, SearchVideosResponse } from '../content-library/interim/search-videos'
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

// YPE-6577: `videos` joins the platform-core unified result. Drop the intersection when platform-sdk-react#488 ships.
export type YouVersionUnifiedSearchField = SearchUnifiedField | 'videos'

export type { SearchVideoHit }

export type YouVersionUnifiedSearchResults = SearchUnifiedResponse & {
  /** ID-only video hits. Resolve each id with `useVideos().get`. */
  videos: readonly SearchVideoHit[]
}

// YPE-6577: replace with `SearchVideosOptions` / `SearchVideosResponse` from `@youversion/platform-core`.
export type { SearchVideosResponse }

export type SearchVideosParams = {
  query: string
  organizationIds?: SearchVideosOptions['organizationIds']
  acceptLanguage?: string
  pageSize?: number
  /** Omit or pass null for the first page. An empty string is kept. */
  pageToken?: string | null
}

export type YouVersionImageSearchResult = SearchImageHit
export type YouVersionImageSearchResults = SearchImagesResponse

export type SearchApiError =
  | { kind: 'auth'; status: 401 | 403; message: string }
  | { kind: 'not-found'; status: 404; message: string }
  | { kind: 'transient'; status?: number; message: string }
  | { kind: 'invalid-parameter'; status?: number; message: string }

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

export type SearchImagesParams = Pick<SearchVersesParams, 'query' | 'bibleId'> & SearchImagesOptions

export type SearchTopicsParams = {
  query: string
  languageRanges: string[]
}
