'use dom'

import type { FootnoteData } from '@youversion/platform-react-ui'
import { BibleReader, YouVersionProvider } from '@youversion/platform-react-ui'
import type { StyleProp, ViewStyle } from 'react-native'

import type { FontFamily } from '../lib/reader-fonts'

export type BibleReaderProps = {
  appKey: string
  defaultVersionId?: number
  themeBackground?: 'light' | 'dark'
  // Expo DOM calls cross a runtime boundary (native <-> WebView), so function props are always async “native actions”.
  onFootnotePress?: (data: FootnoteData) => Promise<void>
  onOpenBibleThemeSettings?: () => Promise<void>
  fontSize?: number
  fontFamily?: FontFamily
  onFontSizeChange?: (fontSize: number) => Promise<void>
  onFontFamilyChange?: (fontFamily: FontFamily) => Promise<void>
  backgroundColor?: string
  foregroundColor?: string
  style?: StyleProp<ViewStyle>
  dom?: import('expo/dom').DOMProps
}

export default function BibleReaderDOM({
  appKey,
  defaultVersionId = 3034,
  themeBackground = 'light',
  onFootnotePress,
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
          defaultVersionId={defaultVersionId}
          onFootnotePress={onFootnotePress}
          fontSize={fontSize}
          fontFamily={fontFamily}
          onFontSizeChange={onFontSizeChange}
          onFontFamilyChange={onFontFamilyChange}
        >
          <BibleReader.Content />
          <BibleReader.Toolbar
            border="top"
            onOpenBibleThemeSettings={onOpenBibleThemeSettings}
          />
        </BibleReader.Root>
      </div>
    </YouVersionProvider>
  )
}
