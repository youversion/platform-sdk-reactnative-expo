import {
  BIBLE_READER_FONT,
  type BibleTextViewProps as WebBibleTextViewProps,
  type FootnoteData,
} from '@youversion/platform-react-ui'
import { useState, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { ThemeContext, useTheme } from '../hooks/use-theme'
import type { DeprecatedDomProps } from '../lib/deprecated-dom-props'
import type { FontFamily } from '../lib/reader-fonts'
import { getImpl } from './component-impls'
import { NativeSheet } from './native-sheet'
import { BibleTextViewNative, type BibleTextViewPassageState } from './bible-text-view-native'

const DEFAULT_FONT_SIZE = BIBLE_READER_FONT.DEFAULT

const EMPTY_FOOTNOTE: FootnoteData = {
  verseNum: '',
  notes: [],
  verseHtml: '',
}

export type BibleTextViewProps = Pick<
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
  /**
   * @deprecated Ignored. The signed-in user's cached highlights paint the passage.
   * This was already true under Expo DOM, where cached highlights won.
   */
  highlightedVerses?: Record<number, string>
  /**
   * @deprecated Ignored. Text renders natively. Will be removed in the next major.
   */
  dom?: DeprecatedDomProps
}

/** A verse, range, or chapter in native text. Same renderer as `BibleReader`. */
export function BibleTextView({
  theme,
  onFootnotePress: consumerOnFootnotePress,
  highlightedVerses: _highlightedVerses,
  dom: _dom,
  fontSize,
  ...props
}: BibleTextViewProps): ReactNode {
  const resolvedTheme = useTheme(theme)
  const [footnoteData, setFootnoteData] = useState<FootnoteData | null>(null)
  // footnoteData can stay set across taps, so each tap is its own open.
  const [footnoteOpenKey, setFootnoteOpenKey] = useState(0)
  const opensSheet = Platform.OS !== 'web' && consumerOnFootnotePress === undefined
  const onFootnotePress =
    consumerOnFootnotePress ??
    (opensSheet
      ? async (data: FootnoteData) => {
          setFootnoteData(data)
          setFootnoteOpenKey((key) => key + 1)
        }
      : undefined)
  const FootnoteContent = getImpl('FootnoteContent')
  const resolvedFontSize = fontSize ?? DEFAULT_FONT_SIZE

  // useTokens reads the provider above the component that calls it, so the override wraps the body.
  return (
    <ThemeContext.Provider value={resolvedTheme}>
      <BibleTextViewNative {...props} fontSize={resolvedFontSize} onFootnotePress={onFootnotePress} />
      {opensSheet && (
        <NativeSheet
          isOpen={footnoteData !== null}
          openKey={footnoteOpenKey}
          onClose={() => setFootnoteData(null)}
          theme={resolvedTheme}
          enableContentPanningGesture={false}
        >
          <FootnoteContent
            data={footnoteData ?? EMPTY_FOOTNOTE}
            theme={resolvedTheme}
            fontSize={resolvedFontSize}
          />
        </NativeSheet>
      )}
    </ThemeContext.Provider>
  )
}
