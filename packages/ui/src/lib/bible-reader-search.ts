import { z } from 'zod'

export const SEARCH_DEBOUNCE_MS = 300
export const SEARCH_QUERY_MAX_LENGTH = 100
export const SEARCH_PAGINATE_REMAINING = 5
export const SEARCH_SNIPPET_MAX_CHARS = 180
export const SEARCH_SNIPPET_LINE_COUNT = 3

const passageSchema = z.object({
  content: z.string(),
  reference: z.string(),
})

export function languageRangesForLocale(locale: string | undefined): string[] {
  if (locale === undefined || locale === '') {
    return ['*']
  }
  return [locale]
}

export function clipSearchQuery(text: string): string {
  if (text.length <= SEARCH_QUERY_MAX_LENGTH) {
    return text
  }
  return text.slice(0, SEARCH_QUERY_MAX_LENGTH)
}

export function formatUsfmLabel(usfm: string): string {
  const parts = usfm.split('.')
  if (parts.length !== 3) {
    return usfm
  }
  const [book, chapter, verse] = parts
  if (book === undefined || chapter === undefined || verse === undefined) {
    return usfm
  }
  return `${book} ${chapter}:${verse}`
}

export function shouldRequestNextPage(highestViewableIndex: number, rowCount: number): boolean {
  if (rowCount === 0) {
    return false
  }
  return highestViewableIndex >= rowCount - SEARCH_PAGINATE_REMAINING
}

export function dedupeVerseUsfms(
  existing: readonly string[],
  incoming: readonly string[],
): string[] {
  const seen = new Set(existing)
  const added: string[] = []
  for (const usfm of incoming) {
    if (seen.has(usfm)) {
      continue
    }
    seen.add(usfm)
    added.push(usfm)
  }
  return added
}

export function verseContentPath(versionId: number, usfm: string): string {
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

export function parsePassageSnippet(body: string): { snippet: string; title: string } | null {
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
  if (snippet === '') {
    return null
  }
  return { snippet, title: parsed.data.reference }
}
