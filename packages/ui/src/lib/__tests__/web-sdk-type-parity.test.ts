/**
 * Public types stay the same shape as the Web SDK types they used to alias.
 * This file is the only place tests import those types on purpose.
 */
import type { DOMProps } from 'expo/dom'
import type { Ref } from 'react'
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
import type {
  BibleReaderHandle,
  BibleReaderProps,
  BibleReaderShareData,
  BibleReaderVerseSelection,
} from '../../native/bible-reader'
import type {
  BibleReaderNavigation,
  BibleReaderVerseFocusAcknowledgment,
} from '../../native/bible-reader-navigation'
import type { BibleTextViewProps } from '../../native/bible-text-view'
import type { VersionDirections } from '../../native/scripture/use-version-directions'
import type { VerseOfTheDayProps } from '../../native/verse-of-the-day'
import type { HighlightWriteError } from '../report-highlight-write-error'
import type { FontFamily } from '../reader-fonts'
import type {
  BibleChapterPickerPressData,
  BibleChapterPickerSelectData,
  BibleTextViewPassageState,
  BibleVersionPickerPressData,
  FootnoteData,
  VerseOfTheDayShareData,
} from '../bible-ui-types'

/** Collapse intersections so optional fields are part of the compared type. */
type Flatten<T> = { [K in keyof T]: T[K] }

/**
 * Strict equality. Dropping a field or adding an optional one makes this `false`.
 * Assignability (`A extends B`) does not, because extra optional fields still assign.
 */
type Equals<A, B> =
  (<T>() => T extends Flatten<A> ? 1 : 2) extends <T>() => T extends Flatten<B> ? 1 : 2
    ? true
    : false

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

type _share = Assert<Equals<BibleReaderShareData, WebBibleReaderShareData>>
type _selection = Assert<Equals<BibleReaderVerseSelection, WebBibleReaderVerseSelection>>
type _footnote = Assert<Equals<FootnoteData, WebFootnoteData>>
type _chapter = Assert<Equals<BibleChapterPickerSelectData, WebBibleChapterPickerSelectData>>
type _version = Assert<Equals<BibleVersionPickerPressData, WebBibleVersionPickerPressData>>
type _votdShare = Assert<Equals<VerseOfTheDayShareData, WebVerseOfTheDayShareData>>

type ExpectedPassage = Omit<WebPassageState, 'error'> & {
  error?: { message: string; name?: string; status?: number; code?: string } | null
}
type _passage = Assert<Equals<BibleTextViewPassageState['passage'], ExpectedPassage['passage']>>
type _loading = Assert<Equals<BibleTextViewPassageState['loading'], ExpectedPassage['loading']>>
type _error = Assert<Equals<BibleTextViewPassageState['error'], ExpectedPassage['error']>>

/**
 * What `BibleReaderProps` accepted on main after `Omit` flattened the auth union.
 * `{ includeAuth: true }`, `{ authRedirectUrl: 'x' }`, and a boolean `includeAuth`
 * with a redirect string all compiled.
 */
type ExpectedBibleReaderProps = {
  onVerseSelect?: (selection: BibleReaderVerseSelection) => Promise<void>
  clearSelectionSignal?: number
  appliedFocusSeq?: number
  onVerseFocusApplied?: (acknowledgment: BibleReaderVerseFocusAcknowledgment) => void
  book?: string
  chapter?: string
  versionId?: number
  versionDirections?: VersionDirections
  onBookChange?: (book: string) => Promise<void>
  onChapterChange?: (chapter: string) => Promise<void>
  onVersionChange?: (versionId: number) => Promise<void>
  onChapterPickerPress?: (data: BibleChapterPickerPressData) => Promise<void>
  showToolbar?: boolean
  backgroundColor?: string
  foregroundColor?: string
  includeAuth?: boolean
  authRedirectUrl?: string
  theme?: 'light' | 'dark' | 'system'
  defaultBook?: string
  defaultChapter?: string
  defaultVersionId?: number
  onFootnotePress?: (data: FootnoteData) => Promise<void>
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  onCopy?: (data: BibleReaderShareData) => void | Promise<void>
  onShare?: (data: BibleReaderShareData) => void | Promise<void>
  onHighlightError?: (error: HighlightWriteError) => void
  ref?: Ref<BibleReaderHandle>
  navigation?: BibleReaderNavigation
  dom?: DOMProps
}

type _card = Assert<Equals<BibleCardProps, ExpectedBibleCardProps>>
type _votd = Assert<Equals<VerseOfTheDayProps, ExpectedVerseOfTheDayProps>>
type _text = Assert<Equals<BibleTextViewProps, ExpectedBibleTextViewProps>>
type _reader = Assert<Equals<BibleReaderProps, ExpectedBibleReaderProps>>
type _passageState = Assert<Equals<BibleTextViewPassageState, ExpectedPassage>>

describe('web sdk type parity', () => {
  it('keeps the assert types above from being stripped', () => {
    const includeAuth: boolean = true
    const acceptedAuth = [
      { includeAuth: true },
      { authRedirectUrl: 'x' },
      { includeAuth, authRedirectUrl: 'x' },
    ] satisfies Array<Pick<BibleReaderProps, 'includeAuth' | 'authRedirectUrl'>>
    expect(acceptedAuth).toHaveLength(3)
  })
})
