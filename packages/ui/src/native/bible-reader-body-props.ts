import type {
  FetchBibleContent,
  Highlight,
  YVUserInfo,
} from '@youversion/platform-react-native-expo-core'
import type {
  BibleChapterPickerPressData,
  BibleReaderVerseSelection,
  BibleVersionPickerPressData,
  FootnoteData,
} from '@youversion/platform-react-ui'
import type { DOMProps } from 'expo/dom'
import type { StyleProp, ViewStyle } from 'react-native'

import type { FontFamily, FontFamilyToken } from '../lib/reader-fonts'
import type {
  BibleReaderVerseFocus,
  BibleReaderVerseFocusAcknowledgment,
} from './bible-reader-navigation'

/**
 * Props `BibleReader` passes to the chapter body.
 * Tests replace that body through the impl registry.
 */
export type BibleReaderBodyProps = {
  appKey: string
  apiHost: string
  installationId: string
  fetchBibleContent: FetchBibleContent
  /** Always passed. `[]` means nothing highlighted. */
  highlights: Highlight[]
  /** `'none'` on iOS and Android, where the native sheet draws verse actions. `'popover'` on web. */
  verseActions: 'popover' | 'none'
  /**
   * Fires on every selection change, clears included (`verses: []`). Carries the
   * selected verses, their passage ids, a localized `reference`, and `shareData`.
   */
  onVerseSelect?: (selection: BibleReaderVerseSelection) => Promise<void>
  /** Increment to clear the current selection. Its value at mount never clears. */
  clearSelectionSignal?: number
  /**
   * Mount leaves `shouldFocus` false.
   * `seq` increases only on focus, including a repeat of the same verse.
   */
  verseFocus?: BibleReaderVerseFocus
  /**
   * Seq already reported through `onVerseFocusApplied`. `0` until that report,
   * so a focus queued before the chapter is ready still runs. A reload passes
   * the reported seq back and does not jump again.
   */
  appliedFocusSeq?: number
  /**
   * Which navigation object `verseFocus.seq` belongs to. Seq restarts at 1 for
   * each object, so a replacement must not inherit the previous high-water mark.
   */
  focusStream?: number
  /** The host stores this seq so a later reload does not refocus. */
  onVerseFocusApplied?: (acknowledgment: BibleReaderVerseFocusAcknowledgment) => void
  theme?: 'light' | 'dark'
  book?: string
  chapter?: string
  versionId?: number
  onBookChange?: (book: string) => Promise<void>
  onChapterChange?: (chapter: string) => Promise<void>
  onVersionChange?: (versionId: number) => Promise<void>
  onChapterPickerPress?: (data: BibleChapterPickerPressData) => Promise<void>
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  onSignInPress?: () => Promise<void>
  onSignOutPress?: () => Promise<void>
  userInfo?: YVUserInfo | null
  showToolbar?: boolean
  onFootnotePress?: (data: FootnoteData) => Promise<void>
  onOpenBibleThemeSettings?: () => void
  onExternalLinkPress?: (url: string) => Promise<void>
  fontSize?: number
  // A token, not the canonical CSS stack. See reader-fonts.ts.
  fontFamily?: FontFamilyToken
  lineSpacing?: number
  onFontSizeChange?: (fontSize: number) => void
  onFontFamilyChange?: (fontFamily: FontFamily) => void
  onLineSpacingChange?: (lineSpacing: number) => void
  backgroundColor?: string
  foregroundColor?: string
  style?: StyleProp<ViewStyle>
  bottomScrollPadding?: number
  dom?: DOMProps
} & (
  | { includeAuth: true; authRedirectUrl: string }
  | { includeAuth?: false; authRedirectUrl?: never }
)
