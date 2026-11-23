// INTERIM (YPE-6577): replaced by @youversion/platform-core once platform-sdk-react#488 ships. Delete this file when adopting it.
// Mirrors packages/core/src/search-unified.ts @ c748d1f942bc9089ea2f466b4fdc973687794487.
// RN: toSearchUnifiedResponse is copied from schemas/search.ts at that commit because platform-core 2.17 drops video hits.

import {
  clampSearchText,
  isValidStructuralUsfmReference,
  parseSearchLanguageRange,
  type ApiClient,
  type SearchImageHit,
  type SearchTopic,
  type SearchVerseHit,
} from '@youversion/platform-core'
import * as z from 'zod/mini'

import { object } from './object'
import { VideoIdSchema } from './video-id'

const SEARCH_UNIFIED_FIELDS = ['verses', 'topics', 'images', 'videos'] as const

export type ContentLibrarySearchField = (typeof SEARCH_UNIFIED_FIELDS)[number]

const KNOWN_SEARCH_USER_INTENTS = ['unknown', 'topical', 'text', 'reference'] as const

const SearchTextQuerySchema = z.string().check(
  z.trim(),
  z.minLength(1, 'Query must be between 1 and 100 characters'),
  z.refine(
    (value) => clampSearchText(value) === value,
    'Query must be between 1 and 100 characters',
  ),
)

const BibleVersionIdSchema = z.int().check(z.positive('Version ID must be a positive integer'))

const SearchUnifiedFieldSchema = z.enum(SEARCH_UNIFIED_FIELDS, {
  error: 'Search field must be verses, topics, images, or videos',
})

const SearchUnifiedFieldsSchema = z.pipe(
  z.array(SearchUnifiedFieldSchema).check(z.minLength(1, 'At least one search field is required')),
  z.transform((fields) => [...new Set(fields)]),
)

const SearchUnifiedOptionsSchema = object({
  userIntent: z.optional(z.enum(KNOWN_SEARCH_USER_INTENTS)),
  fields: z.optional(SearchUnifiedFieldsSchema),
})

type ParsedOptions = z.infer<typeof SearchUnifiedOptionsSchema>

export type ContentLibrarySearchOptions = Readonly<{
  userIntent?: ParsedOptions['userIntent']
  fields?: readonly ContentLibrarySearchField[]
}>

export type SearchVideoHit = Readonly<{ id: string }>

const SearchVideoHitSchema = object({
  id: VideoIdSchema,
})

const VerseWireSchema = object({
  reference: z.string(),
})

const TopicWireSchema = object({
  id: z.nullable(z.int()),
  text: z.string(),
  subtopics: z.array(z.string()),
})

const ImageWireSchema = object({
  id: z.string(),
  passage_id: z.string(),
})

const SearchUnifiedWireSchema = object({
  verses: z.optional(z.array(z.unknown())),
  topics: z.optional(z.array(z.unknown())),
  user_intent: z.optional(z.nullable(z.string())),
  did_you_mean: z.optional(z.array(z.string())),
  search_instead_for: z.optional(z.nullable(z.string())),
  images: z.optional(z.array(z.unknown())),
  videos: z.optional(z.array(z.unknown())),
})

export type ContentLibraryUnifiedSearchResults = {
  verses: SearchVerseHit[]
  topics: SearchTopic[]
  images: SearchImageHit[]
  videos: SearchVideoHit[]
  userIntent?: string
  didYouMean: string[]
  searchInsteadFor: string | null
}

type SearchUnifiedQuery = {
  query: string
  bible_id: number
  'language_ranges[]': string[]
  user_intent?: string
  'fields[]'?: ContentLibrarySearchField[]
}

// RN: platform-core 2.17 exports parseSearchLanguageRange, not parseLanguageRanges.
function parseLanguageRanges(languageRanges: string | readonly string[]): string[] {
  const rangeArray = Array.isArray(languageRanges) ? [...languageRanges] : [languageRanges]
  z.array(z.string())
    .check(z.minLength(1, 'At least one language range is required'))
    .parse(rangeArray)
  return rangeArray.map((range) => parseSearchLanguageRange(range))
}

function toSearchUnifiedResponse(
  wire: z.infer<typeof SearchUnifiedWireSchema>,
): ContentLibraryUnifiedSearchResults {
  const response: ContentLibraryUnifiedSearchResults = {
    verses: (wire.verses ?? []).flatMap((hit) => {
      const parsed = VerseWireSchema.safeParse(hit)
      if (!parsed.success) return []
      if (!isValidStructuralUsfmReference(parsed.data.reference)) return []
      return [{ id: parsed.data.reference }]
    }),
    topics: (wire.topics ?? []).flatMap((hit) => {
      const parsed = TopicWireSchema.safeParse(hit)
      if (!parsed.success) return []
      return [{ id: parsed.data.id, text: parsed.data.text, subtopics: parsed.data.subtopics }]
    }),
    images: (wire.images ?? []).flatMap((hit) => {
      const parsed = ImageWireSchema.safeParse(hit)
      if (!parsed.success) return []
      if (parsed.data.id.length === 0) return []
      if (!isValidStructuralUsfmReference(parsed.data.passage_id)) return []
      return [{ id: parsed.data.id, passageId: parsed.data.passage_id }]
    }),
    videos: (wire.videos ?? []).flatMap((hit) => {
      const parsed = SearchVideoHitSchema.safeParse(hit)
      return parsed.success ? [parsed.data] : []
    }),
    didYouMean: wire.did_you_mean ?? [],
    searchInsteadFor: wire.search_instead_for ?? null,
  }
  if (wire.user_intent == null) {
    return response
  }
  return { ...response, userIntent: wire.user_intent }
}

/**
 * Searches verses, topics, images, and lightweight video ids in one unpaginated request.
 * Selecting `videos` sends the request to beta and requires a beta-enabled app key.
 */
export async function searchUnified(
  client: ApiClient,
  query: string,
  versionId: number,
  languageRanges: string | readonly string[],
  options: ContentLibrarySearchOptions = {},
): Promise<ContentLibraryUnifiedSearchResults> {
  const parsedQuery = SearchTextQuerySchema.parse(query)
  BibleVersionIdSchema.parse(versionId)
  const parsedLanguageRanges = parseLanguageRanges(languageRanges)
  const parsedOptions = SearchUnifiedOptionsSchema.parse(options)

  const params: SearchUnifiedQuery = {
    query: parsedQuery,
    bible_id: versionId,
    'language_ranges[]': parsedLanguageRanges,
  }

  if (parsedOptions.userIntent !== undefined) {
    params.user_intent = parsedOptions.userIntent
  }
  if (parsedOptions.fields !== undefined) {
    params['fields[]'] = parsedOptions.fields
  }

  // Match Swift and Kotlin rollout routing; existing searches keep stable access.
  const path = parsedOptions.fields?.includes('videos')
    ? '/v1-beta/search-unified'
    : '/v1/search-unified'
  const response = await client.get<unknown>(path, params)

  const parsed = SearchUnifiedWireSchema.safeParse(response)
  if (!parsed.success) {
    throw new Error(`Unexpected search-unified API response: ${parsed.error.message}`)
  }

  return toSearchUnifiedResponse(parsed.data)
}
