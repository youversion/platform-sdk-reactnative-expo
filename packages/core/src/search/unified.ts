import { isValidStructuralUsfmReference, type ApiClient } from '@youversion/platform-core'
import { z } from 'zod'

import type {
  SearchUnifiedParams,
  YouVersionImageSearchResult,
  YouVersionSearchTopic,
  YouVersionSearchUserIntent,
  YouVersionUnifiedSearchField,
  YouVersionUnifiedSearchResults,
  YouVersionVerseSearchResult,
} from './types'

const LANGUAGE_RANGE = /^(\*|[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*)$/
const MAX_QUERY_CODE_POINTS = 100
const SEARCH_FIELDS = ['verses', 'topics', 'images'] as const

const languageRangeSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.replace(/_/g, '-').toLowerCase())
  .refine((value) => LANGUAGE_RANGE.test(value))

const querySchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Array.from(value).length <= MAX_QUERY_CODE_POINTS)

const fieldListSchema = z.array(z.enum(SEARCH_FIELDS)).min(1)

const verseHitSchema = z.object({
  reference: z.string(),
})

const topicHitSchema = z.object({
  id: z.number().int().nullable(),
  text: z.string(),
  subtopics: z.array(z.string()),
})

const imageHitSchema = z.union([
  z.null(),
  z.object({
    id: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
    passage_id: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  }),
])

const wireSchema = z.object({
  verses: z.array(z.unknown()).optional(),
  topics: z.array(z.unknown()).optional(),
  images: z.array(z.unknown()).optional(),
})

type WireValue = string | number | boolean | null

type WireImageHit = {
  id?: WireValue
  passage_id?: WireValue
} | null

type UnifiedSearchOptions = {
  fields?: YouVersionUnifiedSearchField[]
  userIntent?: YouVersionSearchUserIntent
}

type UnifiedSearchCall = {
  query: string
  bibleId: number
  languageRanges: string[]
  options: UnifiedSearchOptions
}

type UnifiedSearchQuery = {
  query: string
  bible_id: number
  'language_ranges[]': string[]
  user_intent?: string
  'fields[]'?: YouVersionUnifiedSearchField[]
}

function isWireString(value: WireValue | undefined): value is string {
  return String(value) === value
}

export function buildUnifiedSearchCall(params: SearchUnifiedParams): UnifiedSearchCall {
  const options: UnifiedSearchOptions = {}

  if (params.fields !== undefined) {
    options.fields = params.fields
  }

  if (params.userIntent !== undefined) {
    options.userIntent = params.userIntent
  }

  return {
    query: params.query,
    bibleId: params.bibleId,
    languageRanges: params.languageRanges,
    options,
  }
}

export function mapUnifiedSearchImages(
  images: WireImageHit[] | null | undefined,
): YouVersionImageSearchResult[] {
  if (images === undefined || images === null) {
    return []
  }

  const results: YouVersionImageSearchResult[] = []
  for (const image of images) {
    if (image === null) {
      continue
    }
    if (!isWireString(image.id) || !isWireString(image.passage_id)) {
      continue
    }
    results.push({ id: image.id, passageId: image.passage_id })
  }
  return results
}

// Temporary stand-in until `@youversion/platform-core` publishes `SearchClient.searchUnified`.
export async function requestUnifiedSearch(
  client: ApiClient,
  call: UnifiedSearchCall,
): Promise<YouVersionUnifiedSearchResults> {
  const query = querySchema.parse(call.query)
  const bibleId = z.number().int().positive().parse(call.bibleId)
  const languageRanges = z.array(languageRangeSchema).min(1).parse(call.languageRanges)

  const params: UnifiedSearchQuery = {
    query,
    bible_id: bibleId,
    'language_ranges[]': languageRanges,
  }
  if (call.options.userIntent !== undefined) {
    params.user_intent = call.options.userIntent
  }
  if (call.options.fields !== undefined) {
    params['fields[]'] = uniqueFields(fieldListSchema.parse(call.options.fields))
  }

  const body = await client.get<unknown>('/v1/search-unified', params)
  const wire = wireSchema.safeParse(body)
  if (!wire.success) {
    throw new Error(`Unexpected search-unified API response: ${wire.error.message}`)
  }

  return {
    verses: mapVerses(wire.data.verses ?? []),
    topics: mapTopics(wire.data.topics ?? []),
    images: mapUnifiedSearchImages(mapImageHits(wire.data.images ?? [])),
  }
}

function uniqueFields(fields: YouVersionUnifiedSearchField[]): YouVersionUnifiedSearchField[] {
  const seen = new Set<YouVersionUnifiedSearchField>()
  const unique: YouVersionUnifiedSearchField[] = []
  for (const field of fields) {
    if (seen.has(field)) {
      continue
    }
    seen.add(field)
    unique.push(field)
  }
  return unique
}

function mapVerses(hits: readonly unknown[]): YouVersionVerseSearchResult[] {
  const verses: YouVersionVerseSearchResult[] = []
  for (const hit of hits) {
    const parsed = verseHitSchema.safeParse(hit)
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

function mapTopics(hits: readonly unknown[]): YouVersionSearchTopic[] {
  const topics: YouVersionSearchTopic[] = []
  for (const hit of hits) {
    const parsed = topicHitSchema.safeParse(hit)
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

function mapImageHits(hits: readonly unknown[]): WireImageHit[] {
  const images: WireImageHit[] = []
  for (const hit of hits) {
    const parsed = imageHitSchema.safeParse(hit)
    if (!parsed.success) {
      continue
    }
    images.push(parsed.data)
  }
  return images
}
