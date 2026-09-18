import type { YouVersionVerseSearchResult } from '@youversion/platform-react-native-expo-core'
import { z } from 'zod'

export const SEARCH_DEBOUNCE_MS = 300
export const SEARCH_QUERY_MAX_LENGTH = 100
export const SEARCH_SNIPPET_MAX_CHARS = 180
export const SEARCH_SNIPPET_LINE_COUNT = 3

const passageSchema = z.object({
  content: z.string(),
  reference: z.string(),
})

/** A query that survived clipping and trimming and is known non-blank. */
export type NonBlankQuery = string & { readonly __brand: 'NonBlankQuery' }

/** An opaque page cursor. Never assembled by hand, never rendered. */
export type PageToken = string & { readonly __brand: 'PageToken' }

/** A USFM id as the search API returned it. */
export type Usfm = string & { readonly __brand: 'Usfm' }

/**
 * A verse the sheet is allowed to render. `title` and `snippet` can only come from a parsed
 * passage response, so nothing in scope can pair a usfm with a placeholder title.
 */
export type TitledVerse = {
  readonly usfm: Usfm
  readonly title: string
  readonly snippet: string
}

export function languageRangesForVersionLanguage(languageTag: string | null | undefined): string[] {
  if (languageTag === undefined || languageTag === null || languageTag === '') {
    return ['*']
  }
  return [languageTag]
}

function clipSearchQuery(text: string): string {
  if (text.length <= SEARCH_QUERY_MAX_LENGTH) {
    return text
  }
  return text.slice(0, SEARCH_QUERY_MAX_LENGTH)
}

/** Clips, trims, and brands. `null` when the text is blank. The only way into `NonBlankQuery`. */
export function nonBlankQuery(text: string): NonBlankQuery | null {
  const trimmed = clipSearchQuery(text).trim()
  if (trimmed === '') {
    return null
  }
  return trimmed as NonBlankQuery
}

export function usfmsFromSearchHits(
  hits: readonly YouVersionVerseSearchResult[],
): readonly Usfm[] {
  return hits.map((hit) => hit.id as Usfm)
}

export function pageTokenOf(raw: string | null | undefined): PageToken | null {
  if (raw === undefined || raw === null || raw === '') {
    return null
  }
  return raw as PageToken
}

export function dedupeVerseUsfms(
  seen: ReadonlySet<Usfm>,
  incoming: readonly Usfm[],
): readonly Usfm[] {
  const taken = new Set(seen)
  const added: Usfm[] = []
  for (const usfm of incoming) {
    if (taken.has(usfm)) {
      continue
    }
    taken.add(usfm)
    added.push(usfm)
  }
  return added
}

export function verseContentPath(versionId: number, usfm: Usfm): string {
  return `/v1/bibles/${versionId}/passages/${usfm}?format=text`
}

export function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ')
}

export function trimSnippet(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= SEARCH_SNIPPET_MAX_CHARS) {
    return collapsed
  }
  return collapsed.slice(0, SEARCH_SNIPPET_MAX_CHARS).trimEnd()
}

/** The only constructor for `TitledVerse`. `null` when the passage yields no usable title or snippet. */
export function titledVerseFromPassage(usfm: Usfm, body: string): TitledVerse | null {
  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    return null
  }
  const parsed = passageSchema.safeParse(json)
  if (!parsed.success) {
    return null
  }
  const snippet = trimSnippet(stripHtml(parsed.data.content))
  const title = parsed.data.reference.trim()
  if (snippet === '' || title === '') {
    return null
  }
  return { usfm, title, snippet }
}
