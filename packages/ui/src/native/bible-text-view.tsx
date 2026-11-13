import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import {
  BIBLE_READER_FONT,
  type BibleTextViewProps as WebBibleTextViewProps,
  type FootnoteData,
} from '@youversion/platform-react-ui'
import type { DOMProps } from 'expo/dom'
import { useState, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { ThemeContext, useTheme } from '../hooks/use-theme'
import type { FontFamily } from '../lib/reader-fonts'
import { BibleTextViewNative, type BibleTextViewPassageState } from './bible-text-view-native'
import { getImpl } from './component-impls'
import { NativeSheet } from './native-sheet'
import { useVersionDirections } from './scripture/use-version-directions'

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
  dom?: DOMProps
}

/** A verse, range, or chapter in native text. Same renderer as `BibleReader`. */
export function BibleTextView({
  theme,
  onFootnotePress: consumerOnFootnotePress,
  highlightedVerses: _highlightedVerses,
  dom: _dom,
  fontSize,
  scriptureDirection: hostDirection,
  ...props
}: BibleTextViewProps): ReactNode {
  const { fetchBibleContent } = useYouVersion()
  const versionDirections = useVersionDirections(fetchBibleContent, props.versionId)
  const resolvedTheme = useTheme(theme)
  const [footnoteData, setFootnoteData] = useState<FootnoteData | null>(null)
  // footnoteData can stay set across taps, so each tap is its own open.
  const [footnoteOpenKey, setFootnoteOpenKey] = useState(0)
  // The version the open note came from: a version change must not flip its direction.
  const [footnoteVersionId, setFootnoteVersionId] = useState(props.versionId)
  const opensSheet = Platform.OS !== 'web' && consumerOnFootnotePress === undefined
  const onFootnotePress =
    consumerOnFootnotePress ??
    (opensSheet
      ? async (data: FootnoteData) => {
          setFootnoteData(data)
          setFootnoteVersionId(props.versionId)
          setFootnoteOpenKey((key) => key + 1)
        }
      : undefined)
  const FootnoteContent = getImpl('FootnoteContent')
  const resolvedFontSize = fontSize ?? DEFAULT_FONT_SIZE
  // Host override wins; otherwise the note's originating version (ADR 0023).
  const sheetDirection = hostDirection ?? versionDirections.get(footnoteVersionId)

  // useTokens reads the provider above the component that calls it, so the override wraps the body.
  return (
    <ThemeContext.Provider value={resolvedTheme}>
      <BibleTextViewNative
        {...props}
        fontSize={resolvedFontSize}
        scriptureDirection={hostDirection}
        versionDirections={versionDirections}
        onFootnotePress={onFootnotePress}
      />
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
            scriptureDirection={sheetDirection}
          />
        </NativeSheet>
      )}
    </ThemeContext.Provider>
  )
}
