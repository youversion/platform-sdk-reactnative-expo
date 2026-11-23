// INTERIM (YPE-6577): replaced by @youversion/platform-core once platform-sdk-react#488 ships. Delete this file when adopting it.
// Mirrors packages/core/src/search-videos.ts and packages/core/src/schemas/search-videos.ts @ c748d1f942bc9089ea2f466b4fdc973687794487.

import { clampSearchText, type ApiClient } from '@youversion/platform-core'
import * as z from 'zod/mini'

import { OrganizationIdSchema } from './organization-id'
import { object } from './object'
import { resolveVideoThumbnail } from './video-thumbnail'
import { ContentLibraryVideoSchema } from './video-resource'

// RN: SearchTextQuerySchema is not exported from platform-core 2.17. Same checks as #488.
const SearchVideosQuerySchema = z.string().check(
  z.trim(),
  z.minLength(1, 'Query must be between 1 and 100 characters'),
  z.refine(
    (value) => clampSearchText(value) === value,
    'Query must be between 1 and 100 characters',
  ),
)

export const SearchVideosOptionsSchema = object({
  /** Publisher filters combined with OR. Omit or pass an empty array for no filter. */
  organizationIds: z.optional(z.readonly(z.array(OrganizationIdSchema))),
  /** Language preference. Defaults to English. */
  acceptLanguage: z.optional(z.string().check(z.minLength(1))),
  /** Results per page, from 1 through 99. */
  pageSize: z.optional(z.int().check(z.gte(1), z.lte(99))),
  /** Opaque cursor. Omit or pass null for the first page; empty strings are preserved. */
  pageToken: z.optional(z.nullable(z.string())),
})

export type SearchVideosOptions = z.infer<typeof SearchVideosOptionsSchema>

const SearchVideosWireSchema = object({
  videos: z.array(ContentLibraryVideoSchema),
  user_intent: z.optional(z.nullable(z.string())),
  did_you_mean: z.array(z.string()),
  search_instead_for: z.optional(z.nullable(z.string())),
  next_page_token: z.optional(z.nullable(z.string())),
})

export type SearchVideosResponse = Readonly<{
  videos: z.infer<typeof ContentLibraryVideoSchema>[]
  userIntent?: string
  didYouMean: string[]
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
 * Searches the beta video catalog and returns full video resource records.
 * When continuing with a page token, repeat the query, organization filters, and
 * language from the previous request. The page size may change. A null input
 * cursor requests the first page. Language defaults to English, as in the search API.
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
  if (parsedOptions.pageSize !== undefined) params.page_size = parsedOptions.pageSize
  if (parsedOptions.pageToken != null) params.page_token = parsedOptions.pageToken

  const body = await client.get<unknown>('/v1-beta/search-videos', params, {
    'Accept-Language': parsedOptions.acceptLanguage ?? 'en',
  })
  const parsed = SearchVideosWireSchema.safeParse(body)
  if (!parsed.success) {
    throw new Error(`Unexpected search-videos API response: ${parsed.error.message}`)
  }
  const response: SearchVideosResponse = {
    videos: parsed.data.videos.map((video) => resolveVideoThumbnail(video)),
    didYouMean: parsed.data.did_you_mean,
    searchInsteadFor: parsed.data.search_instead_for ?? null,
    nextPageToken: parsed.data.next_page_token ?? null,
  }
  if (parsed.data.user_intent == null) {
    return response
  }
  return { ...response, userIntent: parsed.data.user_intent }
}
