import {
  ApiClient,
  SearchClient,
  getHttpStatus,
  type SearchQueries,
  type SearchTopicsResponse,
  type SearchVersesResponse,
} from '@youversion/platform-core'

import { DEFAULT_API_HOST } from '../constants'
import { toMessage } from '../error-message'
import { err, ok } from '../result'
import type {
  SearchApiError,
  SearchApiResult,
  SearchTopicsParams,
  SearchVersesParams,
  SuggestedQueriesParams,
  TrendingQueriesParams,
} from './types'

export type CreateSearchApiConfig = {
  appKey: string
  installationId: string
  apiHost?: string
  additionalHeaders?: Record<string, string>
  timeout?: number
}

export type SearchApi = {
  suggestedQueries: (
    params: SuggestedQueriesParams,
  ) => Promise<SearchApiResult<SearchQueries>>
  trendingQueries: (
    params: TrendingQueriesParams,
  ) => Promise<SearchApiResult<SearchQueries>>
  verses: (params: SearchVersesParams) => Promise<SearchApiResult<SearchVersesResponse>>
  topics: (params: SearchTopicsParams) => Promise<SearchApiResult<SearchTopicsResponse>>
}

export function createSearchApi(config: CreateSearchApiConfig): SearchApi {
  const client = new SearchClient(
    new ApiClient({
      appKey: config.appKey,
      apiHost: config.apiHost ?? DEFAULT_API_HOST,
      installationId: config.installationId,
      additionalHeaders: config.additionalHeaders,
      timeout: config.timeout,
    }),
  )

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
    topics({ query, languageRanges }) {
      return catchAsResult(() => client.searchTopics(query, languageRanges))
    },
  }
}

async function catchAsResult<Value>(run: () => Promise<Value>): Promise<SearchApiResult<Value>> {
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

  if (status === undefined && isZodError(caught)) {
    return { kind: 'invalid-parameter', message }
  }

  return status === undefined
    ? { kind: 'transient', message }
    : { kind: 'transient', status, message }
}

function isZodError(caught: Error): boolean {
  return caught.name === 'ZodError' || caught.name === '$ZodError'
}
