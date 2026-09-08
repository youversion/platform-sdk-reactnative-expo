import { z } from 'zod'

import { DEFAULT_API_HOST } from '../constants'
import { toMessage } from '../error-message'
import { err, ok } from '../result'
import { mergeSdkHeaders } from '../sdk-version'
import {
  SEARCH_USER_INTENT,
  type SearchApiError,
  type SearchApiResult,
  type SearchTopicsParams,
  type SearchVersesParams,
  type SuggestedQueriesParams,
  type TrendingQueriesParams,
  type YouVersionSearchQuery,
  type YouVersionSearchTopic,
  type YouVersionTopicSearchResults,
  type YouVersionVerseSearchResult,
  type YouVersionVerseSearchResults,
} from './types'

export type CreateSearchApiConfig = {
  appKey: string
  installationId: string
  apiHost?: string
  additionalHeaders?: Record<string, string>
  /** Matches the Bible content client's 10s. RN's OkHttp ships with no timeouts. */
  timeoutMs?: number
}

export type SearchApi = {
  suggestedQueries: (
    params: SuggestedQueriesParams,
  ) => Promise<SearchApiResult<YouVersionSearchQuery[]>>
  trendingQueries: (
    params: TrendingQueriesParams,
  ) => Promise<SearchApiResult<YouVersionSearchQuery[]>>
  verses: (params: SearchVersesParams) => Promise<SearchApiResult<YouVersionVerseSearchResults>>
  topics: (params: SearchTopicsParams) => Promise<SearchApiResult<YouVersionTopicSearchResults>>
}

const DEFAULT_TIMEOUT_MS = 10_000
const INT32_MAX = 2_147_483_647
const LANGUAGE_RANGE = /^[A-z]{1,8}([-_][0-9A-z]{1,8})*$/
const INVALID_PARAMETER: SearchApiError = {
  kind: 'invalid-parameter',
  message: 'Invalid search parameter',
}

const queryRowSchema = z.object({
  text: z.string(),
  source: z.string().nullish(),
})

const queriesResponseSchema = z.object({
  data: z.array(queryRowSchema),
})

const verseRowSchema = z.object({
  reference: z.string(),
})

const versesResponseSchema = z.object({
  verses: z.array(verseRowSchema),
  user_intent: z.string().nullish(),
  did_you_mean: z.array(z.string()),
  search_instead_for: z.string().nullish(),
  next_page_token: z.string().nullish(),
})

const topicRowSchema = z.object({
  id: z.number().int().nullish(),
  text: z.string(),
  subtopics: z.array(z.string()),
})

const topicsResponseSchema = z.object({
  topics: z.array(topicRowSchema),
  did_you_mean: z.array(z.string()),
  search_instead_for: z.string().nullish(),
  total_size: z.number().int(),
})

/**
 * Temporary Search HTTP client until `@youversion/platform-core` ships
 * `SearchClient` (YPE-5622). Delete this fetch layer and wrap the shared
 * client the way `createHighlightsApi` wraps `HighlightsClient`.
 */
export function createSearchApi(config: CreateSearchApiConfig): SearchApi {
  const apiHost = config.apiHost ?? DEFAULT_API_HOST
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const headers = {
    'X-YVP-App-Key': config.appKey,
    'X-YVP-Installation-Id': config.installationId,
    ...mergeSdkHeaders(config.additionalHeaders),
  }

  return {
    suggestedQueries(params) {
      if (params.query === '') {
        return Promise.resolve(err(INVALID_PARAMETER))
      }
      return fetchQueries({
        apiHost,
        headers,
        timeoutMs,
        languageRanges: params.languageRanges,
        query: params.query,
        trending: false,
      })
    },
    trendingQueries(params) {
      return fetchQueries({
        apiHost,
        headers,
        timeoutMs,
        languageRanges: params.languageRanges,
        query: undefined,
        trending: true,
      })
    },
    verses(params) {
      return fetchVerses({ apiHost, headers, timeoutMs, params })
    },
    topics(params) {
      return fetchTopics({ apiHost, headers, timeoutMs, params })
    },
  }
}

async function fetchQueries({
  apiHost,
  headers,
  timeoutMs,
  languageRanges,
  query,
  trending,
}: {
  apiHost: string
  headers: Record<string, string>
  timeoutMs: number
  languageRanges: string[]
  query: string | undefined
  trending: boolean
}): Promise<SearchApiResult<YouVersionSearchQuery[]>> {
  if (!isValidLanguageRanges(languageRanges)) {
    return err(INVALID_PARAMETER)
  }

  const pairs: [string, string][] = languageRanges.map((range) => ['language_ranges[]', range])
  if (query !== undefined) {
    pairs.push(['query', query])
  }
  if (trending) {
    pairs.push(['trending', 'true'])
  }

  const response = await sendGet(apiHost, '/v1-beta/search-queries', pairs, headers, timeoutMs)
  if (!response.ok) {
    return response
  }
  if (response.value.status === 204) {
    return ok([])
  }
  const parsed = await parseJson(response.value, queriesResponseSchema)
  if (!parsed.ok) {
    return parsed
  }
  return ok(parsed.value.data.map(mapQuery))
}

async function fetchVerses({
  apiHost,
  headers,
  timeoutMs,
  params,
}: {
  apiHost: string
  headers: Record<string, string>
  timeoutMs: number
  params: SearchVersesParams
}): Promise<SearchApiResult<YouVersionVerseSearchResults>> {
  const { query, bibleId, pageSize, pageToken } = params
  const userIntent = params.userIntent ?? SEARCH_USER_INTENT.unknown
  if (!isValidQueryLength(query) || !isValidBibleId(bibleId) || !isValidPageSize(pageSize)) {
    return err(INVALID_PARAMETER)
  }

  const pairs: [string, string][] = [
    ['query', query],
    ['bible_id', String(bibleId)],
    ['user_intent', userIntent],
  ]
  if (pageSize !== undefined) {
    pairs.push(['page_size', String(pageSize)])
  }
  if (pageToken !== undefined) {
    pairs.push(['page_token', pageToken])
  }

  const response = await sendGet(apiHost, '/v1-beta/search-verses', pairs, headers, timeoutMs)
  if (!response.ok) {
    return response
  }
  const parsed = await parseJson(response.value, versesResponseSchema)
  if (!parsed.ok) {
    return parsed
  }
  const body = parsed.value
  return ok({
    verses: body.verses.map(mapVerse),
    userIntent: body.user_intent ?? undefined,
    didYouMean: body.did_you_mean,
    searchInsteadFor: body.search_instead_for ?? undefined,
    nextPageToken: body.next_page_token ?? undefined,
  })
}

async function fetchTopics({
  apiHost,
  headers,
  timeoutMs,
  params,
}: {
  apiHost: string
  headers: Record<string, string>
  timeoutMs: number
  params: SearchTopicsParams
}): Promise<SearchApiResult<YouVersionTopicSearchResults>> {
  const { query, languageRanges } = params
  if (!isValidQueryLength(query) || !isValidLanguageRanges(languageRanges)) {
    return err(INVALID_PARAMETER)
  }

  const pairs: [string, string][] = [
    ['query', query],
    ...languageRanges.map((range): [string, string] => ['language_ranges[]', range]),
  ]

  const response = await sendGet(apiHost, '/v1-beta/search-topics', pairs, headers, timeoutMs)
  if (!response.ok) {
    return response
  }
  const parsed = await parseJson(response.value, topicsResponseSchema)
  if (!parsed.ok) {
    return parsed
  }
  const body = parsed.value
  return ok({
    topics: body.topics.map(mapTopic),
    didYouMean: body.did_you_mean,
    searchInsteadFor: body.search_instead_for ?? undefined,
    totalSize: body.total_size,
  })
}

type HttpOk = { status: number; response: Response }

async function sendGet(
  apiHost: string,
  path: string,
  pairs: [string, string][],
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<SearchApiResult<HttpOk>> {
  const url = buildUrl(apiHost, path, pairs)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    })
    const { status } = response
    if (status === 401 || status === 403) {
      return err({
        kind: 'auth',
        status,
        message: statusText(status),
      })
    }
    if (status === 204) {
      return ok({ status, response })
    }
    if (!response.ok) {
      return err({
        kind: 'transient',
        status,
        message: statusText(status),
      })
    }
    return ok({ status, response })
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught))
    return err({ kind: 'transient', message: toMessage(error) })
  } finally {
    clearTimeout(timer)
  }
}

async function parseJson<T>(
  http: HttpOk,
  schema: z.ZodType<T>,
): Promise<SearchApiResult<T>> {
  try {
    const json: unknown = await http.response.json()
    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      return err({ kind: 'transient', message: 'Unexpected search API response' })
    }
    return ok(parsed.data)
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught))
    return err({ kind: 'transient', message: toMessage(error) })
  }
}

function buildUrl(apiHost: string, path: string, pairs: [string, string][]): string {
  const url = new URL(`https://${apiHost}${path}`)
  for (const [key, value] of pairs) {
    url.searchParams.append(key, value)
  }
  return url.toString()
}

function isValidQueryLength(query: string): boolean {
  return query.length >= 1 && query.length <= 100
}

function isValidBibleId(bibleId: number): boolean {
  return Number.isInteger(bibleId) && bibleId > 0 && bibleId <= INT32_MAX
}

function isValidPageSize(pageSize: number | undefined): boolean {
  if (pageSize === undefined) {
    return true
  }
  return Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 99
}

function isValidLanguageRanges(languageRanges: string[]): boolean {
  if (languageRanges.length === 0) {
    return false
  }
  return languageRanges.every(isValidLanguageRange)
}

function isValidLanguageRange(languageRange: string): boolean {
  return languageRange === '*' || LANGUAGE_RANGE.test(languageRange)
}

function mapQuery(row: z.infer<typeof queryRowSchema>): YouVersionSearchQuery {
  if (row.source == null) {
    return { text: row.text }
  }
  return { text: row.text, source: row.source }
}

function mapVerse(row: z.infer<typeof verseRowSchema>): YouVersionVerseSearchResult {
  return { reference: row.reference }
}

function mapTopic(row: z.infer<typeof topicRowSchema>): YouVersionSearchTopic {
  if (row.id == null) {
    return { text: row.text, subtopics: row.subtopics }
  }
  return { id: row.id, text: row.text, subtopics: row.subtopics }
}

function statusText(status: number): string {
  return `Request failed with status ${status}`
}
