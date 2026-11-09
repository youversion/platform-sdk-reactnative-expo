import {
  SearchClient,
  getHttpStatus,
  type SearchQueries,
  type SearchTopicsResponse,
  type SearchVersesResponse,
} from '@youversion/platform-core'

import { createApiClient } from '../api-client'
import { toMessage } from '../error-message'
import { err, ok } from '../result'
import { isZodError } from '../zod-error'
import type {
  SearchApiError,
  SearchApiResult,
  SearchImagesParams,
  SearchTopicsParams,
  SearchVersesParams,
  SuggestedQueriesParams,
  TrendingQueriesParams,
  YouVersionImageSearchResults,
} from './types'

export type CreateSearchApiConfig = {
  appKey: string
  installationId: string
  apiHost?: string
  additionalHeaders?: Record<string, string>
  timeout?: number
}

export type SearchApi = {
  suggestedQueries: (params: SuggestedQueriesParams) => Promise<SearchApiResult<SearchQueries>>
  trendingQueries: (params: TrendingQueriesParams) => Promise<SearchApiResult<SearchQueries>>
  verses: (params: SearchVersesParams) => Promise<SearchApiResult<SearchVersesResponse>>
  images: (params: SearchImagesParams) => Promise<SearchApiResult<YouVersionImageSearchResults>>
  topics: (params: SearchTopicsParams) => Promise<SearchApiResult<SearchTopicsResponse>>
}

export function createSearchClient(config: CreateSearchApiConfig): SearchClient {
  return new SearchClient(createApiClient(config))
}

export function createSearchApi(config: CreateSearchApiConfig): SearchApi {
  const client = createSearchClient(config)

  return {
    suggestedQueries({ query, languageRanges }) {
      return catchAsResult(() => client.getSuggestedQueries(query, languageRanges))
    },
    trendingQueries({ languageRanges }) {
      return catchAsResult(() => client.getTrendingQueries(languageRanges))
    },
    verses({ query, bibleId, ...options }) {
      return catchAsResult(() => client.searchVerses(query, bibleId, options))
    },
    images({ query, bibleId, ...options }) {
      return catchAsResult(() => client.searchImages(query, bibleId, options))
    },
    topics({ query, languageRanges }) {
      return catchAsResult(() => client.searchTopics(query, languageRanges))
    },
  }
}

export async function catchAsResult<Value>(
  run: () => Promise<Value>,
): Promise<SearchApiResult<Value>> {
  try {
    return ok(await run())
  } catch (caught) {
    return err(toSearchApiError(caught instanceof Error ? caught : new Error(String(caught))))
  }
}

function toSearchApiError(caught: Error): SearchApiError {
  const status = getHttpStatus(caught)
  const message = toMessage(caught)

  if (status === 401 || status === 403) {
    return { kind: 'auth', status, message }
  }

  if (status === 404) {
    return { kind: 'not-found', status, message }
  }

  if (isClientError(status)) {
    return { kind: 'invalid-parameter', status, message }
  }

  if (status === undefined && isZodError(caught)) {
    return { kind: 'invalid-parameter', message }
  }

  if (status === undefined) {
    return { kind: 'transient', message }
  }

  return { kind: 'transient', status, message }
}

function isClientError(status: number | undefined): status is number {
  if (status === undefined) {
    return false
  }
  if (status === 401 || status === 403 || status === 404) {
    return false
  }
  if (status === 408 || status === 429) {
    return false
  }
  return status >= 400 && status < 500
}
