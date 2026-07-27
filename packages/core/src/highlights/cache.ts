import type { Highlight } from '@youversion/platform-core'
import { z } from 'zod'
import { mmkvStorage } from '../storage/mmkv-storage'
import {
  highlightsCacheKey,
  MMKV_HIGHLIGHTS_KEY_PREFIX,
  type HighlightScope,
  type ServerColors,
} from './constants'

export {
  highlightsCacheKey,
  MMKV_HIGHLIGHTS_KEY_PREFIX,
  type HighlightScope,
  type ServerColors,
} from './constants'

/**
 * Minimal hand-rolled mirror of the core `Highlight` API shape.
 *
 * `@youversion/platform-core` keeps its highlight schemas internal
 * (`_HighlightSchema` is declared but not exported), so there is no published
 * schema to reuse. Case-insensitive hex matches the core validator: the API may
 * echo colors in any case.
 */
const highlightSchema = z.object({
  version_id: z.number().int().positive(),
  passage_id: z.string().min(1),
  color: z.string().regex(/^[0-9a-f]{6}$/i),
})

const highlightsSchema = z.array(highlightSchema)

/**
 * Defensive cap on how many verses a single range USFM may expand to. The
 * longest chapter in any Bible (Psalm 119) has 176 verses, so any range longer
 * than this is malformed data and is rejected rather than expanded.
 */
const MAX_RANGE_LENGTH = 250

/** A verse USFM (`JHN.3.16` / `JHN.3.16-18`) split into its parts. */
export type ExpandedPassageId = {
  book: string
  chapter: string
  /** Every verse number covered, ascending (a range expands to each verse). */
  verses: number[]
}

/**
 * Expands a verse or verse-range USFM passage id (`JHN.3.16`, `JHN.3.16-18`)
 * into its book, chapter, and per-verse numbers.
 *
 * Returns `null` for anything that is not a highlightable verse unit: a
 * chapter-scope USFM (`JHN.3`), malformed input, a reversed range, verse 0, or
 * an implausibly large range.
 */
export function expandPassageId(passageId: string): ExpandedPassageId | null {
  const parts = passageId.split('.')
  if (parts.length !== 3) {
    return null
  }
  const [book, chapter, versePart] = parts
  if (!book || !chapter || !versePart) {
    return null
  }

  const match = /^(\d+)(?:-(\d+))?$/.exec(versePart)
  if (!match) {
    return null
  }

  const startRaw = match[1]
  if (startRaw === undefined) {
    return null
  }
  const endRaw = match[2]

  const start = parseInt(startRaw, 10)
  const end = endRaw === undefined ? start : parseInt(endRaw, 10)
  if (start < 1 || end < start || end - start + 1 > MAX_RANGE_LENGTH) {
    return null
  }

  const verses: number[] = []
  for (let verse = start; verse <= end; verse++) {
    verses.push(verse)
  }
  return { book, chapter, verses }
}

/**
 * Projects a cached `Highlight[]` (core API shape) onto the displayed scope as
 * the verse -> hex color render map used for optimistic overlay math.
 *
 * Entries for other versions, books, or chapters are ignored — every entry
 * carries its full identity, so stale data can never mispaint. Range passage
 * ids are expanded per verse. Colors are normalized to lowercase (the API
 * accepts uppercase at the boundary). Later entries win on collisions.
 */
export function deriveServerColors(
  highlights: readonly Highlight[],
  scope: HighlightScope,
): ServerColors {
  const colors: ServerColors = {}
  for (const { version_id, passage_id, color } of highlights) {
    if (version_id !== scope.versionId) {
      continue
    }
    const expanded = expandPassageId(passage_id)
    if (!expanded || expanded.book !== scope.book || expanded.chapter !== scope.chapter) {
      continue
    }
    const normalizedColor = color.toLowerCase()
    for (const verse of expanded.verses) {
      colors[verse] = normalizedColor
    }
  }
  return colors
}

/**
 * Reads the cached raw highlights for a scope. Synchronous by design — the
 * reader paints from cache before the network answers. Returns `null` on a
 * miss or on any corrupt/invalid payload; never throws.
 */
export function getCachedHighlights(userId: string, scope: HighlightScope): Highlight[] | null {
  if (!userId) {
    return null
  }

  try {
    const raw = mmkvStorage.getString(highlightsCacheKey(userId, scope))
    if (raw == null) {
      return null
    }
    const parsed = highlightsSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

/** Persists the raw API shape so passage ids (and ranges) survive a cold start. */
export function setCachedHighlights(
  userId: string,
  scope: HighlightScope,
  highlights: readonly Highlight[],
): void {
  if (!userId) {
    return
  }
  mmkvStorage.set(highlightsCacheKey(userId, scope), JSON.stringify(highlights))
}

export function clearHighlightsCache(): void {
  for (const key of mmkvStorage.getAllKeys()) {
    if (key.startsWith(MMKV_HIGHLIGHTS_KEY_PREFIX)) {
      mmkvStorage.remove(key)
    }
  }
}
