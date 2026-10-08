import type { BibleReaderShareData, BibleReaderVerseSelection } from '@youversion/platform-react-ui'

/** Ports of the Web SDK's verse-share helpers, so native payloads read the same. */
export function normalizeVerses(verses: Iterable<number>): number[] {
  return [...new Set(verses)].sort((a, b) => a - b)
}

export function formatVerseNumbers(verses: readonly number[]): string {
  const ranges: string[] = []
  let start: number | null = null
  let previous: number | null = null
  const close = (): void => {
    if (start === null || previous === null) {
      return
    }
    ranges.push(start === previous ? String(start) : `${start}-${previous}`)
  }
  for (const verse of normalizeVerses(verses)) {
    if (previous !== null && verse === previous + 1) {
      previous = verse
      continue
    }
    close()
    start = verse
    previous = verse
  }
  close()
  return ranges.join(',')
}

export type VerseText = {
  verse: number
  text: string
}

export function joinVerseTexts(entries: readonly VerseText[]): string {
  let joined = ''
  let previous: number | null = null
  for (const entry of entries) {
    const text = entry.text.trim()
    if (previous !== null) {
      joined += entry.verse > previous + 1 ? ' ... ' : ' '
    }
    joined += text
    previous = entry.verse
  }
  return joined.trim()
}

export function buildVerseReference(
  bookName: string,
  chapter: string,
  verses: readonly number[],
  versionAbbreviation: string,
): string {
  return [`${bookName} ${chapter}:${formatVerseNumbers(verses)}`.trim(), versionAbbreviation.trim()]
    .filter(Boolean)
    .join(' ')
}

export type VerseSelectionInput = {
  versionId: number
  book: string
  chapter: string
  verses: Iterable<number>
  bookTitle: string | null
  versionAbbreviation: string | null
  /** Clean text per verse, every fragment joined. */
  verseTexts: ReadonlyMap<number, string>
}

/** The `onVerseSelect` payload; empty selections carry `''` and `null` like the DOM reader. */
export function buildVerseSelection(input: VerseSelectionInput): BibleReaderVerseSelection {
  const verses = normalizeVerses(input.verses)
  const bookName = input.bookTitle ?? input.book
  const selection = {
    versionId: input.versionId,
    book: input.book,
    chapter: input.chapter,
    verses,
    passageIds: verses.map((verse) => `${input.book}.${input.chapter}.${verse}`),
  }
  if (verses.length === 0) {
    return { ...selection, reference: '', shareData: null }
  }
  return {
    ...selection,
    reference: buildVerseReference(bookName, input.chapter, verses, ''),
    shareData: buildShareData(input, verses, bookName),
  }
}

function buildShareData(
  input: VerseSelectionInput,
  verses: number[],
  bookName: string,
): BibleReaderShareData {
  const verseText = joinVerseTexts(
    verses.map((verse) => ({ verse, text: input.verseTexts.get(verse) ?? '' })),
  )
  const reference = buildVerseReference(
    bookName,
    input.chapter,
    verses,
    input.versionAbbreviation ?? '',
  )
  return {
    text: `“${verseText}”\n\n${reference}`,
    reference,
    verseText,
    verses,
    book: input.book,
    chapter: input.chapter,
    versionId: input.versionId,
  }
}

export type FocusTarget = {
  book: string
  chapter: string
  verses: readonly number[]
}

const MAX_FOCUS_VERSES = 250

/** `JHN.3.16` or `JHN.3.16-18`; a chapter-only id focuses nothing. */
export function parseFocusPassageId(passageId: string): FocusTarget | null {
  const match = /^([^.]+)\.([^.]+)\.(\d+)(?:-(\d+))?$/.exec(passageId.trim())
  if (match === null) {
    return null
  }
  const [, book, chapter, startText, endText] = match
  if (book === undefined || chapter === undefined || startText === undefined) {
    return null
  }
  const start = Number(startText)
  // Clamped so a malformed range cannot build a huge array; no chapter runs past 176 verses.
  const end = Math.min(
    endText === undefined ? start : Math.max(start, Number(endText)),
    start + MAX_FOCUS_VERSES - 1,
  )
  const verses: number[] = []
  for (let verse = start; verse <= end; verse += 1) {
    verses.push(verse)
  }
  return { book, chapter, verses }
}
