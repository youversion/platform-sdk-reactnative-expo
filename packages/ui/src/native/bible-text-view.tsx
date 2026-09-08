import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import type { FootnoteData } from '@youversion/platform-react-ui'
import { useState, type ReactNode } from 'react'
import { Platform } from 'react-native'
import type { BibleTextViewProps as BibleTextViewDOMProps } from '../dom/bible-text-view'
import type { FootnoteContentDOMProps } from '../dom/footnote-content'
import { getImpl } from './component-impls'
import { withEmbedDomDefaults, withSheetDomDefaults } from '../lib/embed-dom-props'
import { encodeFontFamilyForDom, type FontFamily } from '../lib/reader-fonts'
import { HighlightsPaint } from './highlights-paint'
import { highlightScopeFor } from './highlight-scope'
import { NativeSheet } from './native-sheet'
import { useTheme } from '../hooks/use-theme'
import { useLocale } from '../i18n/locale-context'
import { getTokens } from '../theme'

// Placeholder so NativeSheet can mount FootnoteContent on page load and pre-warm the WebView.
const EMPTY_FOOTNOTE: FootnoteData = {
  verseNum: '',
  notes: [],
  verseHtml: '',
}

export type BibleTextViewProps = Omit<
  BibleTextViewDOMProps,
  | 'appKey'
  | 'apiHost'
  | 'installationId'
  | 'fetchBibleContent'
  | 'highlights'
  | 'backgroundColor'
  | 'foregroundColor'
  | 'fontFamily'
  | 'theme'
> & {
  theme?: 'light' | 'dark' | 'system'
  fontFamily?: FontFamily
  onFootnotePress?: (data: FootnoteData) => Promise<void>
}

export function BibleTextView({
  onFootnotePress: consumerOnFootnotePress,
  theme: themeOverride,
  fontFamily,
  fontSize,
  dom,
  ...domProps
}: BibleTextViewProps): ReactNode {
  const context = useYouVersion()
  const { lng } = useLocale()
  const resolvedTheme = useTheme(themeOverride)
  const tokens = getTokens(resolvedTheme)
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
  const BibleTextViewDOM = getImpl('BibleTextViewDom')
  const FootnoteContent = getImpl('FootnoteContent')
  const scope = highlightScopeFor(domProps.reference, domProps.versionId)

  return (
    <HighlightsPaint scope={scope}>
      {(highlights) => (
        <>
          <BibleTextViewDOM
            {...domProps}
            appKey={context.appKey}
            apiHost={context.apiHost}
            installationId={context.installationId}
            fetchBibleContent={context.fetchBibleContent}
            permittedVersionIds={context.permittedVersionIds}
            excludedVersionIds={context.excludedVersionIds}
            permittedLanguageTags={context.permittedLanguageTags}
            locale={lng}
            highlights={highlights}
            theme={resolvedTheme}
            fontSize={fontSize}
            fontFamily={fontFamily == null ? undefined : encodeFontFamilyForDom(fontFamily)}
            backgroundColor={tokens.background}
            foregroundColor={tokens.foreground}
            dom={withEmbedDomDefaults(dom)}
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
                fontSize={fontSize}
                appKey={context.appKey}
                apiHost={context.apiHost}
                installationId={context.installationId}
                locale={lng}
              />
            </NativeSheet>
          )}
        </>
      )}
    </HighlightsPaint>
  )
}
