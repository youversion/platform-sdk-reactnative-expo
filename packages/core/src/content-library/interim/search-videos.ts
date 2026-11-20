// INTERIM (YPE-6577): replaced by @youversion/platform-core once platform-sdk-react#488 ships. Delete this file when adopting it.

import type { ApiClient } from '@youversion/platform-core'
import * as z from 'zod/mini'

import { resolveVideoThumbnail } from './video-thumbnail'
import { ContentLibraryVideoSchema, type ContentLibraryVideo } from './video-schemas'

const OrganizationIdSchema = z.pipe(
  z.string().check(z.trim()),
  z.uuid({ error: 'Organization ID must be a valid UUID' }),
)

export const SearchVideosQuerySchema = z.string().check(
  z.trim(),
  z.minLength(1, 'Query must be between 1 and 100 characters'),
  z.refine(
    (value) => Array.from(value).length <= 100,
    'Query must be between 1 and 100 characters',
  ),
)

export const SearchVideosOptionsSchema = z.object({
  /** Publisher filters combined with OR. Omit to search every organization the key can access. */
  organizationIds: z.optional(z.readonly(z.array(OrganizationIdSchema).check(z.minLength(1)))),
  /** Language preference. Defaults to English. */
  acceptLanguage: z.optional(z.string().check(z.minLength(1))),
  pageSize: z.optional(z.int().check(z.gte(1), z.lte(99))),
  pageToken: z.optional(z.string()),
})

export type SearchVideosOptions = z.infer<typeof SearchVideosOptionsSchema>

const SearchVideosWireSchema = z.object({
  videos: z.array(ContentLibraryVideoSchema),
  user_intent: z.nullable(z.string()),
  did_you_mean: z.array(z.string()),
  search_instead_for: z.nullable(z.string()),
  next_page_token: z.optional(z.nullable(z.string())),
})

export type SearchVideosResponse = Readonly<{
  videos: readonly ContentLibraryVideo[]
  userIntent?: string
  didYouMean: readonly string[]
  searchInsteadFor: string | null
  nextPageToken: string | null
}>

type SearchVideosQuery = {
  query: string
  'organization_ids[]'?: string[]
  page_size?: number
  page_token?: string
}

/**
 * Searches `/v1-beta/search-videos`. Stable `/v1/search-videos` is not deployed.
 * Continuation keeps the same query, organizations, and language. Page size may change.
 * An empty page can still carry `nextPageToken`, including `''`.
 */
export async function searchVideos(
  client: ApiClient,
  query: string,
  options: SearchVideosOptions = {},
): Promise<SearchVideosResponse> {
  const parsedQuery = SearchVideosQuerySchema.parse(query)
  const parsedOptions = SearchVideosOptionsSchema.parse(options)
  const params: SearchVideosQuery = { query: parsedQuery }
  if (parsedOptions.organizationIds !== undefined) {
    params['organization_ids[]'] = [...parsedOptions.organizationIds]
  }
  if (parsedOptions.pageSize !== undefined) {
    params.page_size = parsedOptions.pageSize
  }
  if (parsedOptions.pageToken !== undefined) {
    params.page_token = parsedOptions.pageToken
  }
  let language = 'en'
  if (parsedOptions.acceptLanguage !== undefined) {
    language = parsedOptions.acceptLanguage
  }
  const body = await client.get<unknown>('/v1-beta/search-videos', params, {
    'Accept-Language': language,
  })
  const parsed = SearchVideosWireSchema.safeParse(body)
  if (!parsed.success) {
    throw new Error(`Unexpected search-videos API response: ${parsed.error.message}`)
  }
  const response: SearchVideosResponse = {
    videos: parsed.data.videos.map((video) => resolveVideoThumbnail(video)),
    didYouMean: parsed.data.did_you_mean,
    searchInsteadFor: parsed.data.search_instead_for,
    nextPageToken: parsed.data.next_page_token ?? null,
  }
  if (parsed.data.user_intent == null) {
    return response
  }
  return { ...response, userIntent: parsed.data.user_intent }
}
