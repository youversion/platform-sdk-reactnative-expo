import { useControllableState } from '@radix-ui/react-use-controllable-state'
import {
  useYouVersion,
  type FetchBibleContent,
  type Highlight,
} from '@youversion/platform-react-native-expo-core'
import type { BibleVersionPickerPressData, FootnoteData } from '@youversion/platform-react-ui'
import { useEffect, useState, type ReactNode } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'
import { Button, Card, Text } from '../components/ui'
import type { BibleCardProps as BibleCardDOMProps } from '../dom/bible-card'
import { ThemeContext, useTheme, useTokens, type Theme } from '../hooks'
import { useLocale } from '../i18n/locale-context'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { DEFAULT_BIBLE_VERSION_ID } from '../lib/constants'
import { withEmbedDomDefaults, withSheetDomDefaults } from '../lib/embed-dom-props'
import type { InternalLocaleProps } from '../lib/locale-props'
import { encodeFontFamilyForDom, UNTITLED_SERIF_FONT } from '../lib/reader-fonts'
import type { InternalVersionFilterProps } from '../lib/version-filter-props'
import { useBibleCardVersionStore } from '../stores/bible-card-version-store'
import { sansFace } from '../theme/fonts'
import { BibleAppLogo } from './bible-app-logo'
import { getBibleCardMetadata, type BibleCardMetadata } from './bible-card-metadata'
import { BibleVersionPickerSheet } from './bible-version-picker-sheet'
import { getImpl } from './component-impls'
import { HighlightsPaint } from './highlights-paint'
import { highlightScopeFor } from './highlight-scope'
import { NativeSheet } from './native-sheet'

const DEFAULT_FONT_SIZE = 16
const DEFAULT_MAX_WIDTH = 700

// Placeholder so NativeSheet can mount FootnoteContent on page load and pre-warm the WebView.
const EMPTY_FOOTNOTE: FootnoteData = {
  verseNum: '',
  notes: [],
  verseHtml: '',
}

export type BibleCardProps = Omit<
  BibleCardDOMProps,
  | 'appKey'
  | 'apiHost'
  | 'installationId'
  | 'fetchBibleContent'
  | 'onVersionChange'
  | 'onVersionPickerPress'
  | 'theme'
  | 'versionId'
  | 'highlights'
> & {
  theme?: 'light' | 'dark' | 'system'
  versionId?: number
  defaultVersionId?: number
  onVersionChange?: (versionId: number) => void
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  onFootnotePress?: (data: FootnoteData) => Promise<void>
}

type BibleCardBodyProps = Omit<
  BibleCardProps,
  | 'theme'
  | 'versionId'
  | 'defaultVersionId'
  | 'onVersionChange'
  | 'onVersionPickerPress'
  | 'onFootnotePress'
  | 'showVersionPicker'
> &
  InternalVersionFilterProps &
  InternalLocaleProps & {
    highlights: Highlight[]
    appKey: string
    apiHost: string
    installationId: string
    fetchBibleContent: FetchBibleContent
    resolvedTheme: Theme
    versionId: number | undefined
    onVersionPickerPress: (data: BibleVersionPickerPressData) => Promise<void>
    onFootnotePress?: (data: FootnoteData) => Promise<void>
    showVersionPicker: boolean
    showVersionPickerSheet: boolean
    isVersionPickerOpen: boolean
    onCloseVersionPicker: () => void
    onSelectVersion: (newVersionId: number) => Promise<void>
    showFootnoteSheet: boolean
    footnoteData: FootnoteData | null
    onCloseFootnote: () => void
  }

function useBibleCardChromeMetadata(
  fetchBibleContent: FetchBibleContent,
  versionId: number | undefined,
  reference: string,
): BibleCardMetadata | null {
  const [metadata, setMetadata] = useState<BibleCardMetadata | null>(null)

  useEffect(() => {
    if (versionId == null) {
      setMetadata(null)
      return
    }
    let cancelled = false
    void getBibleCardMetadata(fetchBibleContent, versionId, reference).then((data) => {
      if (!cancelled) {
        setMetadata(data)
      }
    })
    return () => {
      cancelled = true
    }
  }, [fetchBibleContent, versionId, reference])

  return metadata
}

function BibleCardBody({
  highlights,
  appKey,
  apiHost,
  installationId,
  fetchBibleContent,
  permittedVersionIds,
  excludedVersionIds,
  permittedLanguageTags,
  locale,
  resolvedTheme,
  versionId,
  onVersionPickerPress,
  onFootnotePress,
  showVersionPicker,
  showVersionPickerSheet,
  isVersionPickerOpen,
  onCloseVersionPicker,
  onSelectVersion,
  showFootnoteSheet,
  footnoteData,
  onCloseFootnote,
  dom,
  reference,
  maxWidth = DEFAULT_MAX_WIDTH,
}: BibleCardBodyProps): ReactNode {
  const { t } = useSdkTranslation()
  const metadata = useBibleCardChromeMetadata(fetchBibleContent, versionId, reference)
  const BibleTextViewDOM = getImpl('BibleTextViewDom')
  const FootnoteContent = getImpl('FootnoteContent')

  return (
    <ThemeContext.Provider value={resolvedTheme}>
      <Card testID="bible-card" style={{ maxWidth, width: '100%', alignSelf: 'center' }}>
        <BibleCardHeader
          reference={metadata?.reference}
          abbreviation={metadata?.abbreviation}
          showVersionPicker={showVersionPicker}
          versionLabel={t('selectVersion')}
          versionAriaLabel={t('changeBibleVersionAriaLabel')}
          onVersionPress={() => {
            void onVersionPickerPress({
              versionId: versionId ?? DEFAULT_BIBLE_VERSION_ID,
              languageId: metadata?.languageTag ?? '',
            })
          }}
        />
        <Card.Content>
          <BibleTextViewDOM
            reference={reference}
            versionId={versionId}
            showVerseNumbers={false}
            fontSize={DEFAULT_FONT_SIZE}
            fontFamily={encodeFontFamilyForDom(UNTITLED_SERIF_FONT)}
            highlights={highlights}
            appKey={appKey}
            apiHost={apiHost}
            installationId={installationId}
            fetchBibleContent={fetchBibleContent}
            permittedVersionIds={permittedVersionIds}
            excludedVersionIds={excludedVersionIds}
            permittedLanguageTags={permittedLanguageTags}
            locale={locale}
            theme={resolvedTheme}
            dom={withEmbedDomDefaults(dom)}
            onFootnotePress={onFootnotePress}
          />
        </Card.Content>
        <Card.Footer style={styles.footer}>
          <Text variant="muted" style={styles.copyright}>
            {metadata?.copyright ?? ''}
          </Text>
          <View
            accessibilityRole="image"
            accessibilityLabel={t('bibleApp')}
            style={styles.attribution}
            testID="bible-card-attribution"
          >
            <BibleAppLogo size={24} />
          </View>
        </Card.Footer>
      </Card>
      {showVersionPickerSheet && (
        <BibleVersionPickerSheet
          isOpen={isVersionPickerOpen}
          onClose={onCloseVersionPicker}
          versionId={versionId}
          theme={resolvedTheme}
          onSelect={onSelectVersion}
        />
      )}
      {showFootnoteSheet && (
        <NativeSheet
          isOpen={!!footnoteData}
          onClose={onCloseFootnote}
          showAndroidLoader
          theme={resolvedTheme}
        >
          <FootnoteContent
            dom={withSheetDomDefaults()}
            data={footnoteData ?? EMPTY_FOOTNOTE}
            theme={resolvedTheme}
            appKey={appKey}
            apiHost={apiHost}
            installationId={installationId}
            locale={locale}
          />
        </NativeSheet>
      )}
    </ThemeContext.Provider>
  )
}

type BibleCardHeaderProps = {
  reference: string | undefined
  abbreviation: string | undefined
  showVersionPicker: boolean
  versionLabel: string
  versionAriaLabel: string
  onVersionPress: () => void
}

function BibleCardHeader({
  reference,
  abbreviation,
  showVersionPicker,
  versionLabel,
  versionAriaLabel,
  onVersionPress,
}: BibleCardHeaderProps): ReactNode {
  const tokens = useTokens()

  return (
    <Card.Header style={styles.header}>
      <View style={styles.titleBlock}>
        {reference ? (
          <Text
            style={[
              { color: tokens.cardForeground },
              sansFace(tokens.fontFamily.sans, 500),
              tokens.typography.sm,
            ]}
          >
            {reference}
          </Text>
        ) : null}
      </View>
      {showVersionPicker ? (
        <Button
          variant="secondary"
          accessibilityLabel={versionAriaLabel}
          onPress={onVersionPress}
          testID="bible-card-version"
        >
          <Button.Text>{abbreviation ?? versionLabel}</Button.Text>
        </Button>
      ) : null}
    </Card.Header>
  )
}

export function BibleCard({
  theme: themeOverride,
  versionId: controlledVersionId,
  defaultVersionId = DEFAULT_BIBLE_VERSION_ID,
  onVersionChange,
  onVersionPickerPress: consumerOnVersionPickerPress,
  onFootnotePress: consumerOnFootnotePress,
  // Matches the React Web SDK default (BibleCard hides the version picker unless opted in).
  showVersionPicker = false,
  dom,
  ...props
}: BibleCardProps): ReactNode {
  const context = useYouVersion()
  const { lng } = useLocale()
  const resolvedTheme = useTheme(themeOverride)

  // This mimics how it's done in the React Web SDK.
  // Controlled only when both versionId + onVersionChange are provided.
  // versionId alone seeds uncontrolled state, preserving backwards compatibility
  // with consumers who use the version picker without an onChange handler.
  const isControlled = controlledVersionId !== undefined && onVersionChange !== undefined

  const { versionId: storedVersionId, setVersionId: setStoredVersionId } = useBibleCardVersionStore(
    useShallow((s) => ({
      versionId: s.versionId,
      setVersionId: s.setVersionId,
    })),
  )

  const [versionId, setVersionId] = useControllableState({
    prop: isControlled ? controlledVersionId : undefined,
    defaultProp: isControlled
      ? defaultVersionId
      : (storedVersionId ?? controlledVersionId ?? defaultVersionId),
    onChange: (newVersionId) => {
      if (!isControlled) setStoredVersionId(newVersionId)
      onVersionChange?.(newVersionId)
    },
  })

  const [footnoteData, setFootnoteData] = useState<FootnoteData | null>(null)
  const [isVersionPickerOpen, setIsVersionPickerOpen] = useState(false)

  const handleVersionPickerPress = async (_data: BibleVersionPickerPressData) => {
    if (Platform.OS === 'web') return
    if (!showVersionPicker) return
    if (consumerOnVersionPickerPress) {
      await consumerOnVersionPickerPress(_data)
    } else {
      setIsVersionPickerOpen(true)
    }
  }

  const handleFootnotePress = async (data: FootnoteData) => {
    setFootnoteData(data)
  }

  const onFootnotePress =
    Platform.OS !== 'web' ? (consumerOnFootnotePress ?? handleFootnotePress) : undefined

  const showVersionPickerSheet =
    Platform.OS !== 'web' && showVersionPicker && !consumerOnVersionPickerPress
  const showFootnoteSheet = Platform.OS !== 'web' && !consumerOnFootnotePress
  const scope = highlightScopeFor(props.reference, versionId)

  return (
    <HighlightsPaint scope={scope}>
      {(highlights) => (
        <BibleCardBody
          {...props}
          highlights={highlights}
          appKey={context.appKey}
          apiHost={context.apiHost}
          installationId={context.installationId}
          fetchBibleContent={context.fetchBibleContent}
          permittedVersionIds={context.permittedVersionIds}
          excludedVersionIds={context.excludedVersionIds}
          permittedLanguageTags={context.permittedLanguageTags}
          locale={lng}
          resolvedTheme={resolvedTheme}
          versionId={versionId}
          onVersionPickerPress={handleVersionPickerPress}
          onFootnotePress={onFootnotePress}
          showVersionPicker={showVersionPicker}
          showVersionPickerSheet={showVersionPickerSheet}
          isVersionPickerOpen={isVersionPickerOpen}
          onCloseVersionPicker={() => setIsVersionPickerOpen(false)}
          onSelectVersion={async (newVersionId) => {
            setVersionId(newVersionId)
          }}
          showFootnoteSheet={showFootnoteSheet}
          footnoteData={footnoteData}
          onCloseFootnote={() => setFootnoteData(null)}
          dom={dom}
        />
      )}
    </HighlightsPaint>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleBlock: {
    flex: 1,
    flexShrink: 1,
  },
  footer: {
    justifyContent: 'space-between',
  },
  copyright: {
    flex: 1,
    flexShrink: 1,
  },
  attribution: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
})
