import type {
  BibleReaderBuiltInVerseAction,
  BibleReaderCustomVerseAction,
  BibleReaderVerseAction,
  BibleReaderVerseRange,
} from '../types/verse-hook-types'

export const DEFAULT_VERSE_ACTIONS: readonly BibleReaderVerseAction[] = [
  'highlight',
  'save',
  'copy',
  'share',
]

/** One item in the sheet's action row, in display order. */
export type ResolvedVerseAction =
  | { kind: 'swatches' }
  | { kind: 'save' }
  | { kind: 'copy' }
  | { kind: 'share' }
  | { kind: 'custom'; action: BibleReaderCustomVerseAction }

function isBuiltIn(action: BibleReaderVerseAction): action is BibleReaderBuiltInVerseAction {
  return action === 'highlight' || action === 'save' || action === 'copy' || action === 'share'
}

/**
 * Orders the sheet's row from the host's list. A duplicate id keeps the first
 * entry and warns in dev — Swift crashes here, which is harsher than a typo
 * deserves. `'highlight'` drops out when there are no swatches to show.
 */
export function resolveVerseActions(
  actions: readonly BibleReaderVerseAction[],
  { hasSwatches }: { hasSwatches: boolean },
): ResolvedVerseAction[] {
  const seen = new Set<string>()
  const resolved: ResolvedVerseAction[] = []
  for (const action of actions) {
    const id = isBuiltIn(action) ? action : action.id
    if (seen.has(id)) {
      if (__DEV__) console.warn(`BibleReader verseActions: duplicate id "${id}" ignored.`)
      continue
    }
    seen.add(id)
    if (action === 'highlight') {
      if (hasSwatches) resolved.push({ kind: 'swatches' })
    } else if (action === 'save' || action === 'copy' || action === 'share') {
      resolved.push({ kind: action })
    } else {
      resolved.push({ kind: 'custom', action })
    }
  }
  return resolved
}

/** Swift's `referencesByMerging`: sorted verses grouped into contiguous ranges. */
export function mergeVerseRanges(selection: {
  versionId: number
  book: string
  chapter: string
  verses: readonly number[]
}): BibleReaderVerseRange[] {
  const { versionId, book, chapter } = selection
  const sorted = [...new Set(selection.verses)].sort((a, b) => a - b)
  const ranges: BibleReaderVerseRange[] = []
  for (const verse of sorted) {
    const last = ranges[ranges.length - 1]
    if (last && verse === last.verseEnd + 1) {
      last.verseEnd = verse
      last.passageId = `${book}.${chapter}.${last.verseStart}-${verse}`
    } else {
      ranges.push({
        versionId,
        book,
        chapter,
        verseStart: verse,
        verseEnd: verse,
        passageId: `${book}.${chapter}.${verse}`,
      })
    }
  }
  return ranges
}
