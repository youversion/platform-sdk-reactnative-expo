/**
 * Public types stay the same shape as the Web SDK types they used to alias.
 * This file is the only place tests import those types on purpose.
 */
import type { DOMProps } from 'expo/dom'
import type {
  BibleCardProps as WebBibleCardProps,
  BibleChapterPickerSelectData as WebBibleChapterPickerSelectData,
  BibleReaderShareData as WebBibleReaderShareData,
  BibleReaderVerseSelection as WebBibleReaderVerseSelection,
  BibleTextViewProps as WebBibleTextViewProps,
  BibleVersionPickerPressData as WebBibleVersionPickerPressData,
  FootnoteData as WebFootnoteData,
  VerseOfTheDayProps as WebVerseOfTheDayProps,
  VerseOfTheDayShareData as WebVerseOfTheDayShareData,
} from '@youversion/platform-react-ui'

import type { BibleCardProps } from '../../native/bible-card'
import type { BibleReaderShareData, BibleReaderVerseSelection } from '../../native/bible-reader'
import type { BibleTextViewProps } from '../../native/bible-text-view'
import type { VerseOfTheDayProps } from '../../native/verse-of-the-day'
import type { FontFamily } from '../reader-fonts'
import type {
  BibleChapterPickerSelectData,
  BibleTextViewPassageState,
  BibleVersionPickerPressData,
  FootnoteData,
  VerseOfTheDayShareData,
} from '../bible-ui-types'

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

type Assert<T extends true> = T

type WebPassageState = NonNullable<WebBibleTextViewProps['passageState']>

type ExpectedBibleTextViewProps = Pick<
  WebBibleTextViewProps,
  | 'reference'
  | 'versionId'
  | 'fontSize'
  | 'lineHeight'
  | 'showVerseNumbers'
  | 'renderNotes'
  | 'selectedVerses'
  | 'scriptureDirection'
> & {
  theme?: 'light' | 'dark' | 'system'
  fontFamily?: FontFamily
  onVerseSelect?: (verses: number[]) => Promise<void>
  onFootnotePress?: (data: FootnoteData) => Promise<void>
  passageState?: BibleTextViewPassageState
  highlightedVerses?: Record<number, string>
  dom?: DOMProps
}

type ExpectedBibleCardProps = Omit<
  WebBibleCardProps,
  'highlights' | 'onFootnotePress' | 'onVersionChange' | 'onVersionPickerPress'
> & {
  dom?: DOMProps
  theme?: 'light' | 'dark' | 'system'
  onVersionChange?: (versionId: number) => void
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  onFootnotePress?: (data: FootnoteData) => Promise<void>
}

type ExpectedVerseOfTheDayProps = Omit<WebVerseOfTheDayProps, 'highlights'> & {
  theme?: 'light' | 'dark' | 'system'
  dom?: DOMProps
}

type _share = Assert<Equal<BibleReaderShareData, WebBibleReaderShareData>>
type _selection = Assert<Equal<BibleReaderVerseSelection, WebBibleReaderVerseSelection>>
type _footnote = Assert<Equal<FootnoteData, WebFootnoteData>>
type _chapter = Assert<Equal<BibleChapterPickerSelectData, WebBibleChapterPickerSelectData>>
type _version = Assert<Equal<BibleVersionPickerPressData, WebBibleVersionPickerPressData>>
type _votdShare = Assert<Equal<VerseOfTheDayShareData, WebVerseOfTheDayShareData>>

type ExpectedPassage = Omit<WebPassageState, 'error'> & {
  error?: { message: string; name?: string; status?: number; code?: string } | null
}
type _passage = Assert<Equal<BibleTextViewPassageState['passage'], ExpectedPassage['passage']>>
type _loading = Assert<Equal<BibleTextViewPassageState['loading'], ExpectedPassage['loading']>>
type _error = Assert<Equal<BibleTextViewPassageState['error'], ExpectedPassage['error']>>

// Component props are intersections on the Web SDK side. Either type has to
// be usable as the other, which is what an importing app needs.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type _card = Assert<Same<BibleCardProps, ExpectedBibleCardProps>>
type _votd = Assert<Same<VerseOfTheDayProps, ExpectedVerseOfTheDayProps>>
type _text = Assert<Same<BibleTextViewProps, ExpectedBibleTextViewProps>>
type _passageState = Assert<Same<BibleTextViewPassageState, ExpectedPassage>>

describe('web sdk type parity', () => {
  it('keeps the assert types above from being stripped', () => {
    const ok: true = true
    expect(ok).toBe(true)
  })
})
