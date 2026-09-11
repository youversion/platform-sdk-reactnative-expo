import type { BibleReference } from './types'

/**
 * Parses a verse USFM (`BOOK.CHAPTER.VERSE`) into a Bible reference.
 * Invalid input — wrong segment count, empty book, or non-positive chapter /
 * verse — returns `null`. Reader will drop those later.
 */
export function bibleReferenceFromUsfm(usfm: string, versionId: number): BibleReference | null {
  const parts = usfm.split('.')
  if (parts.length !== 3) {
    return null
  }
  const [bookId, chapterPart, versePart] = parts
  if (bookId === undefined || chapterPart === undefined || versePart === undefined) {
    return null
  }
  if (bookId === '') {
    return null
  }
  const chapter = parsePositiveInt(chapterPart)
  const verse = parsePositiveInt(versePart)
  if (chapter === null || verse === null) {
    return null
  }
  return { versionId, bookId, chapter, verse }
}

function parsePositiveInt(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null
  }
  const parsed = Number.parseInt(value, 10)
  if (parsed < 1) {
    return null
  }
  return parsed
}
