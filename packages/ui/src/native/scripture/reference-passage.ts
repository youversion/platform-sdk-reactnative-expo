import { expandPassageId } from '@youversion/platform-react-native-expo-core'

import type { VersionGate } from '../../lib/version-usability'
import { isPsalmTitle, isSpacer, type Block } from './parse-passage'
import {
  passageKey,
  passageRefFor,
  type LoadedPassage,
  type PassageError,
  type PassageRef,
} from './use-passage'

export type VerseSpan = {
  book: string
  chapter: string
  /** Inclusive. Null is the whole chapter. */
  verses: { start: number; end: number } | null
}

/**
 * Chapter, verse, or verse-range USFM. Whole chapters (numeric or catalog ids
 * like `INTRO`) go through `passageRefFor`. Verse and range forms use core's
 * `expandPassageId` so MAX_RANGE_LENGTH and reverse-range rules stay shared.
 */
export function verseSpanFromPassageId(passageId: string): VerseSpan | null {
  const versePart = passageId.split('.')[2]
  if (versePart === undefined) {
    const ref = passageRefFor(passageId)
    if (ref === null) {
      return null
    }
    return { book: ref.book, chapter: ref.chapter, verses: null }
  }
  const expanded = expandPassageId(passageId)
  if (expanded === null) {
    return null
  }
  const start = expanded.verses[0]
  const end = expanded.verses[expanded.verses.length - 1]
  if (start === undefined || end === undefined) {
    return null
  }
  return { book: expanded.book, chapter: expanded.chapter, verses: { start, end } }
}

// Sliced blocks are cached by chapter blocks and span so each keeps its
// identity across renders: Passage's layout cache and memo key on it.
const spanCache = new WeakMap<readonly Block[], Map<string, readonly Block[]>>()

/**
 * A verse embed shows those verses, as Swift's range render does. With `headings`, a
 * heading stays when the next verse after it is in range. A Psalm title follows the
 * verse beside it, headings or not.
 */
export function blocksInSpan(
  blocks: readonly Block[],
  span: VerseSpan,
  headings: boolean,
): readonly Block[] {
  if (span.verses === null) {
    return blocks
  }
  const { start, end } = span.verses
  const key = `${start}-${end}-${headings ? 'h' : ''}`
  let bySpan = spanCache.get(blocks)
  if (bySpan === undefined) {
    bySpan = new Map()
    spanCache.set(blocks, bySpan)
  }
  const cached = bySpan.get(key)
  if (cached !== undefined) {
    return cached
  }
  const inRange = (verse: number): boolean => verse >= start && verse <= end
  // Swift starts rendering only when the range opens the chapter.
  let rendering = start <= 1
  const kept: Block[] = []
  blocks.forEach((block, index) => {
    if (block.heading) {
      if (isPsalmTitle(block)) {
        if (rendering) {
          kept.push(block)
        }
        return
      }
      // Swift also keeps one with no verse after it; an orphan heading reads as a bug.
      const next = headings ? firstVerseFrom(blocks, index + 1) : null
      if (next !== null && inRange(next)) {
        kept.push(block)
      }
      return
    }
    for (const segment of block.segments) {
      if (segment.verse !== null) {
        rendering = inRange(segment.verse)
      }
    }
    const segments = block.segments.filter(
      (segment) => segment.verse !== null && inRange(segment.verse),
    )
    if (segments.length === 0) {
      return
    }
    const verses = [
      ...new Set(segments.flatMap((segment) => (segment.verse === null ? [] : [segment.verse]))),
    ]
    kept.push({ ...block, segments, verses })
  })
  // A spacer carries the verse before it, so one can end a range but never start one.
  let last = kept.at(-1)
  while (last !== undefined && isSpacer(last)) {
    kept.pop()
    last = kept.at(-1)
  }
  bySpan.set(key, kept)
  return kept
}

// The next verse that opens, as Swift's `firstVerseInNode`: a line that only carries
// the verse before (NIV's "He said:" under a heading) does not count.
function firstVerseFrom(blocks: readonly Block[], from: number): number | null {
  for (const block of blocks.slice(from)) {
    for (const segment of block.segments) {
      if (segment.verse !== null && segment.inlines.some((inline) => inline.kind === 'label')) {
        return segment.verse
      }
    }
  }
  return null
}

export type VersionLookupError = 'offline' | 'failed'

export type ScripturePhase =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'failed'; retry: 'version' | 'passage' }
  | { kind: 'offline'; retry: 'version' | 'passage' }
  | { kind: 'passage'; blocks: readonly Block[] }

export type ScripturePhaseInput = {
  span: VerseSpan | null
  versionId: number
  gate: VersionGate
  /** Fetch address for the current request; used to tell stale retained content from current. */
  address: PassageRef | null
  versionError: VersionLookupError | null
  passage: LoadedPassage | null
  loading: boolean
  error: PassageError | null
  /** Keep section headings in a verse range, as Swift's BibleCard does; VOTD drops them. */
  headings: boolean
}

export function scripturePhase(input: ScripturePhaseInput): ScripturePhase {
  if (input.span === null || input.gate === 'refused') {
    return { kind: 'unavailable' }
  }
  if (input.gate === 'checking') {
    return { kind: 'loading' }
  }
  if (input.gate === 'lookupFailed') {
    return input.versionError === 'offline'
      ? { kind: 'offline', retry: 'version' }
      : { kind: 'failed', retry: 'version' }
  }
  if (input.error === 'offline') {
    return { kind: 'offline', retry: 'passage' }
  }
  if (input.error === 'unavailable') {
    return { kind: 'unavailable' }
  }
  if (input.error === 'failed') {
    return { kind: 'failed', retry: 'passage' }
  }
  const loaded = input.passage
  const current =
    loaded !== null &&
    input.address !== null &&
    loaded.key === passageKey(input.versionId, input.address)
  if (!current || loaded === null) {
    return { kind: 'loading' }
  }
  const blocks = blocksInSpan(loaded.parsed.blocks, input.span, input.headings)
  if (blocks.length === 0) {
    return input.loading ? { kind: 'loading' } : { kind: 'unavailable' }
  }
  return { kind: 'passage', blocks }
}
