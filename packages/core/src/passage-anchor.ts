export type BiblePassageAnchor = {
  versionId: number
  bookId: string
  chapter: number
  /** Absent for a chapter-only passage id. For a verse range, the start verse. */
  verse?: number
}

/**
 * Parse a passage id into a {@link BiblePassageAnchor}.
 *
 * Accepts chapter-only (`PSA.23`), a single verse (`JHN.3.16`), and a verse
 * range (`JHN.3.16-17`). A range keeps the start verse and drops the end.
 * Returns `null` only for structurally invalid input.
 */
export function biblePassageAnchorFromPassageId(
  passageId: string,
  versionId: number,
): BiblePassageAnchor | null {
  const parts = passageId.split('.')
  if (parts.length !== 2 && parts.length !== 3) {
    return null
  }
  const [bookId, chapterPart, versePart] = parts
  if (bookId === undefined || chapterPart === undefined) {
    return null
  }
  if (!/^[A-Z0-9]{3}$/.test(bookId)) {
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
