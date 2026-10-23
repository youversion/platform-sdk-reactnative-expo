import { parseChapterScopeFromUsfm } from '@youversion/platform-react-native-expo-core'

import type { Block } from './parse-passage'
import { passageKey, type LoadedPassage, type PassageError } from './use-passage'

export type VerseSpan = {
  book: string
  chapter: string
  /** Inclusive. Null is the whole chapter. */
  verses: { start: number; end: number } | null
}

/**
 * Chapter, verse, or verse-range USFM. The chapter scope is the same one
 * highlights subscribe to. A range keeps both ends.
 */
export function verseSpanFromPassageId(passageId: string): VerseSpan | null {
  const scope = parseChapterScopeFromUsfm(passageId)
  if (scope === null) {
    return null
  }
  const versePart = passageId.split('.')[2]
  if (versePart === undefined) {
    return { book: scope.book, chapter: scope.chapter, verses: null }
  }
  const match = /^(\d+)(?:-(\d+))?$/.exec(versePart)
  const startRaw = match?.[1]
  if (startRaw === undefined) {
    return null
  }
  const start = Number.parseInt(startRaw, 10)
  const end = match?.[2] === undefined ? start : Number.parseInt(match[2], 10)
  return { book: scope.book, chapter: scope.chapter, verses: { start, end } }
}

/** A verse embed shows those verses, not the chapter's section headings. */
export function blocksInSpan(blocks: readonly Block[], span: VerseSpan): Block[] {
  if (span.verses === null) {
    return [...blocks]
  }
  const { start, end } = span.verses
  const kept: Block[] = []
  for (const block of blocks) {
    if (block.heading) {
      continue
    }
    const segments = block.segments.filter(
      (segment) => segment.verse !== null && segment.verse >= start && segment.verse <= end,
    )
    if (segments.length === 0) {
      continue
    }
    const verses = [
      ...new Set(segments.flatMap((segment) => (segment.verse === null ? [] : [segment.verse]))),
    ]
    kept.push({ ...block, segments, verses })
  }
  return kept
}

export type VersionLookupError = 'offline' | 'failed'

export type ScripturePhase =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'failed'; retry: 'version' | 'passage' }
  | { kind: 'offline'; retry: 'version' | 'passage' }
  | { kind: 'passage'; blocks: readonly Block[]; loaded: LoadedPassage }

export type ScripturePhaseInput = {
  span: VerseSpan | null
  versionId: number
  refused: boolean
  awaitingLanguage: boolean
  versionLookupBlocked: boolean
  versionError: VersionLookupError | null
  passage: LoadedPassage | null
  loading: boolean
  error: PassageError | null
}

export function scripturePhase(input: ScripturePhaseInput): ScripturePhase {
  if (input.span === null || input.refused) {
    return { kind: 'unavailable' }
  }
  if (input.awaitingLanguage) {
    return { kind: 'loading' }
  }
  if (input.versionLookupBlocked) {
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
    loaded.key === passageKey(input.versionId, input.span.book, input.span.chapter)
  if (!current || loaded === null) {
    return { kind: 'loading' }
  }
  const blocks = blocksInSpan(loaded.parsed.blocks, input.span)
  if (blocks.length === 0) {
    return input.loading ? { kind: 'loading' } : { kind: 'unavailable' }
  }
  return { kind: 'passage', blocks, loaded }
}
