import type { BibleReference } from './types'

/**
 * Parse a search-hit USFM into a {@link BibleReference}.
 *
 * Accepts chapter-only (`PSA.23`), a single verse (`JHN.3.16`), and a verse
 * range (`JHN.3.16-17`). Ranges use the start verse as the navigation anchor.
 * Returns `null` only for structurally invalid input, not for "not a single
 * verse".
 */
export function bibleReferenceFromUsfm(usfm: string, versionId: number): BibleReference | null {
  const parts = usfm.split('.')
  if (parts.length !== 2 && parts.length !== 3) {
    return null
  }
  const [bookId, chapterPart, versePart] = parts
  if (bookId === undefined || bookId === '' || chapterPart === undefined) {
    return null
  }
  const chapter = parsePositiveInt(chapterPart)
  if (chapter === null) {
    return null
  }
  if (versePart === undefined) {
    return { versionId, bookId, chapter }
  }

  const verseSegments = versePart.split('-')
  if (verseSegments.length > 2) {
    return null
  }
  const [startPart, endPart] = verseSegments
  if (startPart === undefined) {
    return null
  }
  const verse = parsePositiveInt(startPart)
  if (verse === null) {
    return null
  }
  if (endPart !== undefined && parsePositiveInt(endPart) === null) {
    return null
  }
  return { versionId, bookId, chapter, verse }
}

function parsePositiveInt(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null
  }
  const parsed = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return null
  }
  return parsed
}
