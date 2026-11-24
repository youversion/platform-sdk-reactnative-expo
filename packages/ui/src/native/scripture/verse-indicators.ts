import type {
  VerseIndicatorStyle,
  VerseIndicatorStyleResolver,
  VerseIndicatorTarget,
} from '../../types/verse-hook-types'
import type { Block } from './parse-passage'

export type IndicatorScope = { versionId: number; book: string; chapter: string }

export function indicatorTarget(scope: IndicatorScope, verse: number): VerseIndicatorTarget {
  const { versionId, book, chapter } = scope
  return { versionId, book, chapter, verse, passageId: `${book}.${chapter}.${verse}` }
}

/**
 * Asks the host once per labelled verse. Only verses with a printed number can carry a
 * marker, so hidden verse numbers mean no indicators, as in Swift.
 */
export function resolveIndicators(
  blocks: readonly Block[],
  scope: IndicatorScope,
  resolver: VerseIndicatorStyleResolver | undefined,
): ReadonlyMap<number, VerseIndicatorStyle> | undefined {
  if (resolver === undefined) {
    return undefined
  }
  const styles = new Map<number, VerseIndicatorStyle>()
  for (const block of blocks) {
    for (const segment of block.segments) {
      const { verse } = segment
      if (verse === null || styles.has(verse)) {
        continue
      }
      if (!segment.inlines.some((inline) => inline.kind === 'label')) {
        continue
      }
      const style = resolver(indicatorTarget(scope, verse))
      if (style !== null) {
        styles.set(verse, style)
      }
    }
  }
  return styles.size === 0 ? undefined : styles
}
