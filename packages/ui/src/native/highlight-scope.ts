import {
  parseChapterScopeFromUsfm,
  type HighlightScope,
} from '@youversion/platform-react-native-expo-core'

/**
 * Highlight Scope from a USFM reference (verse, range, or chapter) plus version.
 * `null` and `undefined` reference are the same: no scope, so paint-only
 * surfaces skip subscribe/fetch until a real chapter is known.
 */
export function highlightScopeFor(
  reference: string | null | undefined,
  versionId: number | undefined,
): HighlightScope | null {
  if (reference == null || typeof versionId !== 'number') {
    return null
  }
  const parsed = parseChapterScopeFromUsfm(reference)
  if (parsed === null) {
    return null
  }
  return { versionId, book: parsed.book, chapter: parsed.chapter }
}
