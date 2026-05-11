'use dom'

import type { FootnoteData, BibleChapterPickerPressData } from '@youversion/platform-react-ui'
import { BibleReader, YouVersionProvider } from '@youversion/platform-react-ui'
import type { StyleProp, ViewStyle } from 'react-native'

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
  onFootnotePress?: (data: FootnoteData) => Promise<void>

  showToolbar?: boolean

  fontSize?: number
  fontFamily?: string
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
  fontSize,
  fontFamily,
  backgroundColor,
  foregroundColor,
}: BibleReaderProps) {
  const sanitizeCssValue = (value: string | undefined) => value?.replace(/[{};]/g, '').trim()

  return (
    <YouVersionProvider appKey={appKey} theme={themeBackground}>
      <style href="yv-bible-reader-overrides" precedence="medium">
        {`[data-slot="yv-bible-renderer"] {
          ${fontSize ? `--yv-reader-font-size: ${fontSize}px !important;` : ''}
          ${fontFamily ? `--yv-reader-font-family: ${sanitizeCssValue(fontFamily)} !important;` : ''}
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
        >
          {showToolbar && <BibleReader.Toolbar />}
          <BibleReader.Content />
        </BibleReader.Root>
      </div>
    </YouVersionProvider>
  )
}
