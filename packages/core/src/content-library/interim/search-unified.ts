// INTERIM (YPE-6577): replaced by @youversion/platform-core once platform-sdk-react#488 ships. Delete this file when adopting it.

import {
  clampSearchText,
  isValidStructuralUsfmReference,
  parseSearchLanguageRange,
} from '@youversion/platform-core'
import type { ApiClient, SearchImageHit, SearchTopic, SearchVerseHit } from '@youversion/platform-core'
import * as z from 'zod/mini'

import { VideoIdSchema } from './video-id'

const SEARCH_FIELDS = ['verses', 'topics', 'images', 'videos'] as const

export type ContentLibrarySearchField = (typeof SEARCH_FIELDS)[number]

const KNOWN_USER_INTENTS = ['unknown', 'topical', 'text', 'reference'] as const

export type ContentLibrarySearchOptions = Readonly<{
  userIntent?: (typeof KNOWN_USER_INTENTS)[number]
  fields?: readonly ContentLibrarySearchField[]
}>

export type SearchVideoHit = Readonly<{ id: string }>

export type ContentLibraryUnifiedSearchResults = {
  verses: SearchVerseHit[]
  topics: SearchTopic[]
  images: SearchImageHit[]
  videos: SearchVideoHit[]
  userIntent?: string
  didYouMean: string[]
  searchInsteadFor: string | null
}

const SearchTextQuerySchema = z.string().check(
  z.trim(),
  z.minLength(1, 'Query must be between 1 and 100 characters'),
  z.refine(
    (value) => clampSearchText(value) === value,
    'Query must be between 1 and 100 characters',
  ),
)

const BibleVersionIdSchema = z.int().check(z.positive('Version ID must be a positive integer'))

const SearchFieldSchema = z.enum(SEARCH_FIELDS, {
  error: 'Search field must be verses, topics, images, or videos',
})

const SearchFieldsSchema = z.pipe(
  z.array(SearchFieldSchema).check(z.minLength(1, 'At least one search field is required')),
  z.transform((fields) => [...new Set(fields)]),
)

const SearchOptionsSchema = z.object({
  userIntent: z.optional(z.enum(KNOWN_USER_INTENTS)),
  fields: z.optional(SearchFieldsSchema),
})

const VerseWireSchema = z.object({
  reference: z.string(),
})

const TopicWireSchema = z.object({
  id: z.nullable(z.int()),
  text: z.string(),
  subtopics: z.array(z.string()),
})

const ImageWireSchema = z.object({
  id: z.string(),
  passage_id: z.string(),
})

const UnifiedWireSchema = z.object({
  verses: z.optional(z.array(z.unknown())),
  topics: z.optional(z.array(z.unknown())),
  images: z.optional(z.array(z.unknown())),
  videos: z.optional(z.array(z.unknown())),
  user_intent: z.optional(z.nullable(z.string())),
  did_you_mean: z.optional(z.array(z.string())),
  search_instead_for: z.optional(z.nullable(z.string())),
})

type UnifiedQuery = {
  query: string
  bible_id: number
  'language_ranges[]': string[]
  user_intent?: string
  'fields[]'?: ContentLibrarySearchField[]
}

function languageRanges(value: string | readonly string[]): string[] {
  const ranges = Array.isArray(value) ? [...value] : [value]
  z.array(z.string())
    .check(z.minLength(1, 'At least one language range is required'))
    .parse(ranges)
  return ranges.map((range) => parseSearchLanguageRange(range))
}

function verseHits(hits: readonly unknown[]): SearchVerseHit[] {
  const verses: SearchVerseHit[] = []
  for (const hit of hits) {
    const parsed = VerseWireSchema.safeParse(hit)
    if (!parsed.success) {
      continue
    }
    if (!isValidStructuralUsfmReference(parsed.data.reference)) {
      continue
    }
    verses.push({ id: parsed.data.reference })
  }
  return verses
}

function topicHits(hits: readonly unknown[]): SearchTopic[] {
  const topics: SearchTopic[] = []
  for (const hit of hits) {
    const parsed = TopicWireSchema.safeParse(hit)
    if (!parsed.success) {
      continue
    }
    topics.push({
      id: parsed.data.id,
      text: parsed.data.text,
      subtopics: parsed.data.subtopics,
    })
  }
  return topics
}

function imageHits(hits: readonly unknown[]): SearchImageHit[] {
  const images: SearchImageHit[] = []
  for (const hit of hits) {
    const parsed = ImageWireSchema.safeParse(hit)
    if (!parsed.success) {
      continue
    }
    if (parsed.data.id.length === 0) {
      continue
    }
    if (!isValidStructuralUsfmReference(parsed.data.passage_id)) {
      continue
    }
    images.push({ id: parsed.data.id, passageId: parsed.data.passage_id })
  }
  return images
}

function videoHits(hits: readonly unknown[]): SearchVideoHit[] {
  const videos: SearchVideoHit[] = []
  for (const hit of hits) {
    const parsed = z.object({ id: VideoIdSchema }).safeParse(hit)
    if (!parsed.success) {
      continue
    }
    videos.push({ id: parsed.data.id })
  }
  return videos
}

/**
 * One request to stable `/v1/search-unified` for verses, topics, images, and
 * ID-only videos. Field selection does not switch hosts.
 */
export async function searchUnified(
  client: ApiClient,
  query: string,
  versionId: number,
  ranges: string | readonly string[],
  options: ContentLibrarySearchOptions = {},
): Promise<ContentLibraryUnifiedSearchResults> {
  const parsedQuery = SearchTextQuerySchema.parse(query)
  const bibleId = BibleVersionIdSchema.parse(versionId)
  const parsedRanges = languageRanges(ranges)
  const parsedOptions = SearchOptionsSchema.parse(options)
  const params: UnifiedQuery = {
    query: parsedQuery,
    bible_id: bibleId,
    'language_ranges[]': parsedRanges,
  }
  if (parsedOptions.userIntent !== undefined) {
    params.user_intent = parsedOptions.userIntent
  }
  if (parsedOptions.fields !== undefined) {
    params['fields[]'] = parsedOptions.fields
  }
  const body = await client.get<unknown>('/v1/search-unified', params)
  const parsed = UnifiedWireSchema.safeParse(body)
  if (!parsed.success) {
    throw new Error(`Unexpected search-unified API response: ${parsed.error.message}`)
  }
  const wire = parsed.data
  const response: ContentLibraryUnifiedSearchResults = {
    verses: verseHits(wire.verses ?? []),
    topics: topicHits(wire.topics ?? []),
    images: imageHits(wire.images ?? []),
    videos: videoHits(wire.videos ?? []),
    didYouMean: wire.did_you_mean ?? [],
    searchInsteadFor: wire.search_instead_for ?? null,
  }
  if (wire.user_intent == null) {
    return response
  }
  return { ...response, userIntent: wire.user_intent }
}
