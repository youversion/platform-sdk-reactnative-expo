import { isValidStructuralUsfmReference } from '@youversion/platform-core'
import * as z from 'zod/mini'

export const MAX_SEARCH_QUERY_GRAPHEMES = 100

let searchTextSegmenter: Intl.Segmenter | undefined

/** Truncates to 100 graphemes, or Unicode code points when Intl.Segmenter is unavailable. */
export function clampSearchText(raw: string): string {
  if (Intl.Segmenter === undefined) {
    return Array.from(raw).slice(0, MAX_SEARCH_QUERY_GRAPHEMES).join('')
  }
  searchTextSegmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  const segments = searchTextSegmenter.segment(raw)[Symbol.iterator]()
  let end = 0
  for (let count = 0; count < MAX_SEARCH_QUERY_GRAPHEMES; count += 1) {
    const next = segments.next()
    if (next.done) {
      return raw
    }
    end = next.value.index + next.value.segment.length
  }
  return raw.slice(0, end)
}

/** Known Platform Search user-intent values. Unknown wire strings remain valid. */
export const KNOWN_SEARCH_USER_INTENTS = ['unknown', 'topical', 'text', 'reference'] as const

export type KnownSearchUserIntent = (typeof KNOWN_SEARCH_USER_INTENTS)[number]

/** Normalizes caller language ranges for search endpoints (`en_US` → `en-us`). */
export function normalizeSearchLanguageRange(range: string): string {
  return range.trim().replace(/_/g, '-').toLowerCase()
}

/**
 * Platform Search `language_ranges[]` filter grammar: `*` or a Basic Language Range
 * subset (ISO 639 primary subtag plus optional hyphen extensions such as region).
 * Not full BCP 47. Language API resource ids use {@link BCP47_LANGUAGE_TAG_REGEX}.
 */
const SEARCH_LANGUAGE_RANGE_REGEX = /^(\*|[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*)$/

const SEARCH_LANGUAGE_RANGE_ERROR =
  'Language range must be "*" or a Basic Language Range (e.g., "en", "en-US")'

/** Validates and normalizes one search language range (`EN`, `en_US` → `en`, `en-us`). */
export function parseSearchLanguageRange(range: string): string {
  const trimmed = z
    .string()
    .check(z.trim(), z.minLength(1, 'Language ranges must be a non-empty string'))
    .parse(range)
  const normalized = normalizeSearchLanguageRange(trimmed)
  z.string()
    .check(z.regex(SEARCH_LANGUAGE_RANGE_REGEX, SEARCH_LANGUAGE_RANGE_ERROR))
    .parse(normalized)
  return normalized
}

/** Validates and normalizes one or more search language ranges. */
export function parseLanguageRanges(languageRanges: string | readonly string[]): string[] {
  const rangeArray = Array.isArray(languageRanges) ? [...languageRanges] : [languageRanges]
  z.array(z.string())
    .check(z.minLength(1, 'At least one language range is required'))
    .parse(rangeArray)
  return rangeArray.map(parseSearchLanguageRange)
}

/** Verse search hit; `id` is USFM and matches {@link BiblePassage.id} semantics. */
export const SearchVerseHitSchema = z.object({
  /** USFM passage identifier (e.g., "JHN.6.9") */
  id: z.string(),
})

export type SearchVerseHit = Readonly<z.infer<typeof SearchVerseHitSchema>>

export const SearchVerseHitWireSchema = z.object({
  /** USFM reference on the wire (mapped to SDK `id`) */
  reference: z.string(),
})

export type SearchVerseHitWire = z.infer<typeof SearchVerseHitWireSchema>

export function toSearchVerseHit(wire: SearchVerseHitWire): SearchVerseHit | null {
  if (!isValidStructuralUsfmReference(wire.reference)) {
    return null
  }
  return { id: wire.reference }
}

export const SearchTopicSchema = z.object({
  /** Nullable catalog identifier */
  id: z.optional(z.nullable(z.int())),
  /** Topic label */
  text: z.string(),
  /** Related subtopic labels */
  subtopics: z.array(z.string()),
})

export type SearchTopic = Readonly<z.infer<typeof SearchTopicSchema>>

export const SearchTopicWireSchema = z.object({
  id: z.optional(z.nullable(z.int())),
  text: z.string(),
  subtopics: z.array(z.string()),
})

export type SearchTopicWire = z.infer<typeof SearchTopicWireSchema>

export function toSearchTopic(wire: SearchTopicWire): SearchTopic {
  const topic: SearchTopic = {
    text: wire.text,
    subtopics: wire.subtopics,
  }
  if (wire.id !== undefined) {
    return { ...topic, id: wire.id }
  }
  return topic
}

/** Input validation for verse/topic search queries (1–100 grapheme clusters). */
export const SearchTextQuerySchema = z.string().check(
  z.trim(),
  z.minLength(1, 'Query must be between 1 and 100 characters'),
  z.refine(
    (value) => clampSearchText(value) === value,
    'Query must be between 1 and 100 characters',
  ),
)

const SEARCH_UNIFIED_FIELDS = ['verses', 'topics'] as const

export type SearchUnifiedField = (typeof SEARCH_UNIFIED_FIELDS)[number]

const SearchUnifiedFieldSchema = z.enum(SEARCH_UNIFIED_FIELDS, {
  error: 'Search field must be verses or topics',
})

const SearchUnifiedFieldsSchema = z.pipe(
  z.array(SearchUnifiedFieldSchema).check(z.minLength(1, 'At least one search field is required')),
  z.transform((fields) => [...new Set(fields)]),
)

export const SearchUnifiedOptionsSchema = z.object({
  /** Omit to use the service default, `unknown`. */
  userIntent: z.optional(z.enum(KNOWN_SEARCH_USER_INTENTS)),
  fields: z.optional(SearchUnifiedFieldsSchema),
})

type SearchUnifiedOptionsParsed = z.infer<typeof SearchUnifiedOptionsSchema>

export type SearchUnifiedOptions = Readonly<{
  userIntent?: SearchUnifiedOptionsParsed['userIntent']
  fields?: readonly SearchUnifiedField[]
}>

const SearchUnifiedTopicHitWireSchema = z.extend(SearchTopicWireSchema, {
  id: z.nullable(z.int()),
})

export type SearchUnifiedTopicHitWire = z.infer<typeof SearchUnifiedTopicHitWireSchema>

export const SearchUnifiedWireSchema = z.object({
  verses: z.optional(z.array(z.unknown())),
  topics: z.optional(z.array(z.unknown())),
  user_intent: z.optional(z.nullable(z.string())),
  did_you_mean: z.optional(z.array(z.string())),
  search_instead_for: z.optional(z.nullable(z.string())),
  /** Reserved on the wire for image hits; ignored until the API ships this field. */
  images: z.optional(z.array(z.unknown())),
})

export type SearchUnifiedWire = z.infer<typeof SearchUnifiedWireSchema>

export const SearchUnifiedResponseSchema = z.object({
  /** Verse hits. Malformed USFM references are removed. */
  verses: z.array(SearchVerseHitSchema),
  topics: z.array(SearchTopicSchema),
  /**
   * Image hits reserved for a future unified-search response shape.
   * Optional until image search ships; will become required in a later release.
   */
  images: z.optional(z.array(z.unknown())),
  /** Set only when the API returns a non-null user intent. */
  userIntent: z.optional(z.string()),
  didYouMean: z.array(z.string()),
  searchInsteadFor: z.nullable(z.string()),
})

export type SearchUnifiedResponse = Readonly<z.infer<typeof SearchUnifiedResponseSchema>>

type EnsureSearchUnifiedFieldArrays<T extends Record<SearchUnifiedField, true>> = T

type _SearchUnifiedFieldCoverage = EnsureSearchUnifiedFieldArrays<{
  [K in SearchUnifiedField]: SearchUnifiedResponse[K] extends readonly unknown[] ? true : false
}>

export function toSearchUnifiedResponse(wire: SearchUnifiedWire): SearchUnifiedResponse {
  let response: SearchUnifiedResponse = {
    verses: (wire.verses ?? []).flatMap((hit) => {
      const parsed = SearchVerseHitWireSchema.safeParse(hit)
      if (!parsed.success) {
        return []
      }
      const verse = toSearchVerseHit(parsed.data)
      return verse === null ? [] : [verse]
    }),
    topics: (wire.topics ?? []).flatMap((hit) => {
      const parsed = SearchUnifiedTopicHitWireSchema.safeParse(hit)
      if (!parsed.success) {
        return []
      }
      return [toSearchTopic(parsed.data)]
    }),
    didYouMean: wire.did_you_mean ?? [],
    searchInsteadFor: wire.search_instead_for ?? null,
  }
  if (wire.images !== undefined && wire.images.length > 0) {
    response = { ...response, images: wire.images }
  }
  if (wire.user_intent != null) {
    response = { ...response, userIntent: wire.user_intent }
  }
  return response
}
