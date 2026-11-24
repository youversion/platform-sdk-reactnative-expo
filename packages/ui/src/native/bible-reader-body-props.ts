import type { FetchBibleContent, Highlight } from '@youversion/platform-react-native-expo-core'

import type { FootnoteData, BibleReaderVerseSelection } from '../types/bible-ui-types'
import type { FontFamily } from '../lib/reader-fonts'
import type {
  VerseIndicatorStyleResolver,
  VerseIndicatorTarget,
} from '../types/verse-hook-types'
import type {
  BibleReaderVerseFocus,
  BibleReaderVerseFocusAcknowledgment,
} from './bible-reader-navigation'
import type { VersionDirections } from './scripture/use-version-directions'

/**
 * Props `BibleReader` passes to the chapter body.
 * Tests replace that body through the impl registry.
 */
export type BibleReaderBodyProps = {
  fetchBibleContent: FetchBibleContent
  /** Always passed. `[]` means nothing highlighted. */
  highlights: Highlight[]
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
  book?: string
  chapter?: string
  versionId?: number
  /** Per-version text direction from the index; see ADR 0023. */
  versionDirections?: VersionDirections
  onFootnotePress?: (data: FootnoteData) => Promise<void>
  onExternalLinkPress?: (url: string) => Promise<void>
  fontSize?: number
  fontFamily?: FontFamily
  lineSpacing?: number
  backgroundColor?: string
  foregroundColor?: string
  bottomScrollPadding?: number
  /**
   * Marks a verse number with a styled indicator. Return `null` to keep the
   * plain number. Resolved once per chapter render; only verses that render a
   * number can carry one.
   */
  verseIndicatorStyle?: VerseIndicatorStyleResolver
  /** A tap on an indicator. It wins over the verse tap and does not select the verse. */
  onVerseIndicatorPress?: (target: VerseIndicatorTarget) => void
}
