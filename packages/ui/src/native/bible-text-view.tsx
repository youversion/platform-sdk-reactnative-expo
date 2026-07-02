import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import type { FootnoteData } from '@youversion/platform-react-ui'
import { useState } from 'react'
import { Platform, useColorScheme } from 'react-native'
import type { BibleTextViewProps as BibleTextViewDOMProps } from '../dom/bible-text-view'
import BibleTextViewDOM from '../dom/bible-text-view'
import type { FootnoteContentDOMProps } from '../dom/footnote-content'
import FootnoteContent from '../dom/footnote-content'
import { resolveTheme } from '../lib/resolve-theme'
import { withSheetDomDefaults } from '../lib/embed-dom-props'
import { NativeSheet } from './native-sheet'
import { useTheme } from '../hooks/use-theme'

const EMPTY_FOOTNOTE: FootnoteData = {
  verseNum: '',
  notes: [],
  verseHtml: '',
}

export type BibleTextViewProps = Omit<
  BibleTextViewDOMProps,
  'appKey' | 'apiHost' | 'installationId'
> & {
  onFootnotePress?: (data: FootnoteData) => Promise<void>
}

export function BibleTextView({
  onFootnotePress: consumerOnFootnotePress,
  ...domProps
}: BibleTextViewProps) {
  const context = useYouVersion()
  const themeContext = useTheme()
  const theme = domProps.theme ?? themeContext
  const colorScheme = useColorScheme()
  const resolvedTheme = resolveTheme(theme, colorScheme)
  const [footnoteData, setFootnoteData] = useState<FootnoteData | null>(null)
  // footnoteData can remain non-null across repeated taps, so track each tap as an open event.
  const [footnoteOpenKey, setFootnoteOpenKey] = useState(0)

  const onFootnotePress =
    Platform.OS !== 'web'
      ? (consumerOnFootnotePress ??
        (async (data: FootnoteData) => {
          setFootnoteData(data)
          setFootnoteOpenKey((key) => key + 1)
        }))
      : undefined

  const showSheet = Platform.OS !== 'web' && !consumerOnFootnotePress
  const footnoteTheme: FootnoteContentDOMProps['theme'] = resolvedTheme

  return (
    <>
      <BibleTextViewDOM
        {...domProps}
        appKey={context.appKey}
        apiHost={context.apiHost}
        installationId={context.installationId}
        theme={theme}
        onFootnotePress={onFootnotePress}
      />
      {showSheet && (
        <NativeSheet
          isOpen={!!footnoteData}
          openKey={footnoteOpenKey}
          onClose={() => setFootnoteData(null)}
          showAndroidLoader
          theme={footnoteTheme}
        >
          <FootnoteContent
            dom={withSheetDomDefaults()}
            data={footnoteData ?? EMPTY_FOOTNOTE}
            theme={footnoteTheme}
            fontSize={domProps.fontSize}
            appKey={context.appKey}
            apiHost={context.apiHost}
            installationId={context.installationId}
          />
        </NativeSheet>
      )}
    </>
  )
}
