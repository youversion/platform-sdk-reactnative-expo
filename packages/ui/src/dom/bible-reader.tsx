'use dom'

import type { FootnoteData, BibleChapterPickerPressData } from '@youversion/platform-react-ui'
import { BibleReader, YouVersionProvider } from '@youversion/platform-react-ui'
import type { StyleProp, ViewStyle } from 'react-native'

import type { FontFamily } from '../lib/reader-fonts'

export type BibleReaderProps = {
  appKey: string
  themeBackground?: 'light' | 'dark'
  book?: string
  chapter?: string
  versionId?: number
  onBookChange?: (book: string) => Promise<void>
  onChapterChange?: (chapter: string) => Promise<void>
  onVersionChange?: (versionId: number) => Promise<void>
  onChapterPickerPress?: (data: BibleChapterPickerPressData) => Promise<void>
  onSettingsPress?: () => Promise<void>
  showToolbar?: boolean
  onFootnotePress?: (data: FootnoteData) => Promise<void>
  onOpenBibleThemeSettings?: () => void
  fontSize?: number
  fontFamily?: FontFamily
  onFontSizeChange?: (fontSize: number) => void
  onFontFamilyChange?: (fontFamily: FontFamily) => void
  backgroundColor?: string
  foregroundColor?: string
  style?: StyleProp<ViewStyle>
  dom?: import('expo/dom').DOMProps
}

export default function BibleReaderDOM({
  appKey,
  themeBackground = 'light',
  book,
  chapter,
  versionId,
  onBookChange,
  onChapterChange,
  onVersionChange,
  onChapterPickerPress,
  onFootnotePress,
  showToolbar = true,
  onOpenBibleThemeSettings,
  fontSize,
  fontFamily,
  onFontSizeChange,
  onFontFamilyChange,
  backgroundColor,
  foregroundColor,
}: BibleReaderProps) {
  const sanitizeCssValue = (value: string | undefined) => value?.replace(/[{};]/g, '').trim()

  // fontSize/fontFamily use controlled props (not CSS overrides like bg/fg)
  // because the in-WebView toolbar also mutates them — controlled props keep
  // MMKV and the Web SDK's internal state in sync bidirectionally.
  return (
    <YouVersionProvider appKey={appKey} theme={themeBackground}>
      <style href="yv-bible-reader-overrides" precedence="medium">
        {`[data-slot="yv-bible-renderer"] {
          ${backgroundColor ? `--yv-reader-bg: ${sanitizeCssValue(backgroundColor)} !important;` : ''}
          ${foregroundColor ? `--yv-reader-fg: ${sanitizeCssValue(foregroundColor)} !important;` : ''}
        }`}
      </style>
      <div style={{ position: 'relative', height: '100%', width: '100%' }}>
        <BibleReader.Root
          book={book}
          chapter={chapter}
          versionId={versionId}
          onBookChange={onBookChange}
          onChapterChange={onChapterChange}
          onVersionChange={onVersionChange}
          onChapterPickerPress={onChapterPickerPress}
          onFootnotePress={onFootnotePress}
          fontSize={fontSize}
          fontFamily={fontFamily}
          onFontSizeChange={onFontSizeChange}
          onFontFamilyChange={onFontFamilyChange}
        >
          {showToolbar && (
            <BibleReader.Toolbar
              border="bottom"
              onOpenBibleThemeSettings={onOpenBibleThemeSettings}
            />
          )}
          <BibleReader.Content />
        </BibleReader.Root>
      </div>
    </YouVersionProvider>
  )
}
