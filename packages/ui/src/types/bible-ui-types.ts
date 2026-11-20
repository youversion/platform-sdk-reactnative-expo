import type { BiblePassage } from '@youversion/platform-core'

/**
 * Local copies of the Web SDK payload types native code still speaks.
 * Field for field the same as `@youversion/platform-react-ui` 2.17.0.
 * The dependency itself stays until YPE-6583.
 */

export type TextDirection = 'ltr' | 'rtl'

export type FootnoteData = {
  verseNum: string
  notes: string[]
  verseHtml: string
  reference?: string
}

export type BibleChapterPickerPressData = {
  book: string
  chapter: string
  versionId: number
}

export type BibleChapterPickerSelectData = BibleChapterPickerPressData

export type BibleVersionPickerPressData = {
  versionId: number
  languageId: string
}

export type BibleReaderShareData = {
  /** Full body: curly-quoted verse text, a blank line, then the reference. */
  text: string
  /** Reference line only, e.g. `John 1:1-3 NIV`. */
  reference: string
  /** Verse text only (no reference line), gaps joined with ` ... `. */
  verseText: string
  /** Selected verse numbers, ascending and de-duplicated. */
  verses: number[]
  book: string
  chapter: string
  versionId: number
}

export type BibleReaderVerseSelection = {
  /** Matches `Highlight.version_id`. */
  versionId: number
  /** USFM book code, e.g. `'JHN'`. */
  book: string
  /** Chapter id, e.g. `'3'`. */
  chapter: string
  /** Selected verse numbers, ascending and de-duplicated. `[]` on clear. */
  verses: number[]
  /** Per-verse USFM ids, e.g. `['JHN.3.16', 'JHN.3.17']`. Never ranges. */
  passageIds: string[]
  /**
   * Localized display reference without the version abbreviation.
   * `''` on clear.
   */
  reference: string
  /**
   * Copy / Share payload for the current selection. `null` on clear.
   */
  shareData: BibleReaderShareData | null
}

export type VerseOfTheDayShareData = {
  /** Full share body: verse text, blank line, then reference. */
  text: string
  /** Human-readable reference line, e.g. "John 3:16 NIV". */
  reference: string
  /** Verse body only, without the reference line. */
  verseText: string
  /** Optional deep link; not populated today. */
  url?: string
}

/**
 * Host-supplied passage for `BibleTextView`. Optional fields, and `error`
 * is the small status object the native view already reads.
 * `passage` is core's `BiblePassage`, the same value the Web SDK puts here.
 */
export type BibleTextViewPassageState = {
  passage?: BiblePassage | null
  loading?: boolean
  error?: { message: string; name?: string; status?: number; code?: string } | null
}
