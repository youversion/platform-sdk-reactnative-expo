import { useControllableState } from '@radix-ui/react-use-controllable-state'
import {
  useYouVersion,
  type FetchBibleContent,
  type Highlight,
} from '@youversion/platform-react-native-expo-core'
import type { BibleVersionPickerPressData, FootnoteData } from '@youversion/platform-react-ui'
import { useEffect, useRef, useState, type ReactNode } from 'react'
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
/** Web `yv:card-content` when `maxWidth="100%"` — full-bleed shell, capped inner column. */
const FULL_BLEED_INNER_MAX_WIDTH = 600

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
  | 'background'
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
    versionPickerRequiresLanguageId: boolean
    showVersionPickerSheet: boolean
    isVersionPickerOpen: boolean
    onCloseVersionPicker: () => void
    onSelectVersion: (newVersionId: number) => Promise<void>
    showFootnoteSheet: boolean
    footnoteData: FootnoteData | null
    onCloseFootnote: () => void
  }

type BibleCardMetadataKey = {
  reference: string
  versionId: number
  filters: InternalVersionFilterProps
  fetchBibleContent: FetchBibleContent
}

function sameOptionalList<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean {
  if (a === b) {
    return true
  }
  if (a === undefined || b === undefined) {
    return false
  }
  if (a.length !== b.length) {
    return false
  }
  return a.every((item, index) => item === b[index])
}

function sameFilters(a: InternalVersionFilterProps, b: InternalVersionFilterProps): boolean {
  return (
    sameOptionalList(a.permittedVersionIds, b.permittedVersionIds) &&
    sameOptionalList(a.excludedVersionIds, b.excludedVersionIds) &&
    sameOptionalList(a.permittedLanguageTags, b.permittedLanguageTags)
  )
}

function metadataMatchesKey(
  loadedFor: BibleCardMetadataKey | null,
  versionId: number | undefined,
  reference: string,
  filters: InternalVersionFilterProps,
  fetchBibleContent: FetchBibleContent,
): loadedFor is BibleCardMetadataKey {
  return (
    loadedFor != null &&
    versionId != null &&
    loadedFor.versionId === versionId &&
    loadedFor.reference === reference &&
    loadedFor.fetchBibleContent === fetchBibleContent &&
    sameFilters(loadedFor.filters, filters)
  )
}

function useBibleCardChromeMetadata(
  fetchBibleContent: FetchBibleContent,
  versionId: number | undefined,
  reference: string,
  filters: InternalVersionFilterProps,
): BibleCardMetadata | null {
  const [metadata, setMetadata] = useState<BibleCardMetadata | null>(null)
  const loadedForRef = useRef<BibleCardMetadataKey | null>(null)
  const { permittedVersionIds, excludedVersionIds, permittedLanguageTags } = filters

  useEffect(() => {
    if (versionId == null) {
      setMetadata(null)
      loadedForRef.current = null
      return
    }
    let cancelled = false
    const requestFilters = { permittedVersionIds, excludedVersionIds, permittedLanguageTags }
    void getBibleCardMetadata(fetchBibleContent, versionId, reference, requestFilters).then(
      (data) => {
        if (!cancelled) {
          setMetadata(data)
          loadedForRef.current = {
            versionId,
            reference,
            filters: requestFilters,
            fetchBibleContent,
          }
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [
    fetchBibleContent,
    versionId,
    reference,
    permittedVersionIds,
    excludedVersionIds,
    permittedLanguageTags,
  ])

  return metadataMatchesKey(loadedForRef.current, versionId, reference, filters, fetchBibleContent)
    ? metadata
    : null
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
  versionPickerRequiresLanguageId,
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
  const metadata = useBibleCardChromeMetadata(fetchBibleContent, versionId, reference, {
    permittedVersionIds,
    excludedVersionIds,
    permittedLanguageTags,
  })
  const BibleTextViewDOM = getImpl('BibleTextViewDom')
  const FootnoteContent = getImpl('FootnoteContent')
  const tokens = useTokens()
  const title =
    metadata?.reference == null
      ? undefined
      : metadata.abbreviation == null
        ? metadata.reference
        : `${metadata.reference} ${metadata.abbreviation}`
  const versionPickerDisabled =
    versionPickerRequiresLanguageId && metadata?.languageTag == null
  const isFullBleed = maxWidth === '100%'

  return (
    <ThemeContext.Provider value={resolvedTheme}>
      <Card testID="bible-card" style={{ maxWidth, width: '100%', alignSelf: 'center' }}>
        <View
          testID="bible-card-inner"
          style={isFullBleed ? styles.fullBleedInner : styles.defaultInner}
        >
          <BibleCardHeader
            title={title}
            abbreviation={metadata?.abbreviation}
            showVersionPicker={showVersionPicker}
            versionLabel={t('selectVersion')}
            versionAriaLabel={t('changeBibleVersionAriaLabel')}
            versionPickerDisabled={versionPickerDisabled}
            onVersionPress={() => {
              if (versionPickerRequiresLanguageId && metadata?.languageTag == null) {
                return
              }
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
            <Text
              style={[
                styles.copyright,
                { color: tokens.mutedForeground },
                sansFace(tokens.fontFamily.sans, 700),
              ]}
            >
              {metadata?.copyright ?? ''}
            </Text>
            <View
              accessibilityRole="image"
              accessibilityLabel={t('bibleApp')}
              style={styles.attribution}
              testID="bible-card-attribution"
            >
              <BibleAppLogo size={24} />
              <Text variant="muted">{t('bibleApp')}</Text>
            </View>
          </Card.Footer>
        </View>
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
  title: string | undefined
  abbreviation: string | undefined
  showVersionPicker: boolean
  versionLabel: string
  versionAriaLabel: string
  versionPickerDisabled: boolean
  onVersionPress: () => void
}

function BibleCardHeader({
  title,
  abbreviation,
  showVersionPicker,
  versionLabel,
  versionAriaLabel,
  versionPickerDisabled,
  onVersionPress,
}: BibleCardHeaderProps): ReactNode {
  const tokens = useTokens()

  return (
    <Card.Header style={styles.header}>
      <View style={styles.titleBlock}>
        {title ? (
          <Text
            accessibilityRole="header"
            style={[
              styles.referenceTitle,
              { color: tokens.cardForeground },
              sansFace(tokens.fontFamily.sans, 700),
            ]}
          >
            {title}
          </Text>
        ) : null}
      </View>
      {showVersionPicker ? (
        <Button
          variant="secondary"
          accessibilityLabel={versionAriaLabel}
          disabled={versionPickerDisabled}
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
  background,
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
  // Web SDK `background` forces the surface scheme when `theme` is omitted.
  const resolvedTheme = useTheme(themeOverride ?? background)

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

  // NativeSheet / BibleVersionPickerSheet are no-ops on web. Keep the consumer
  // handler path live; hide the built-in trigger when only the sheet would open.
  const canShowVersionPicker =
    showVersionPicker && (Platform.OS !== 'web' || consumerOnVersionPickerPress != null)

  const handleVersionPickerPress = async (data: BibleVersionPickerPressData) => {
    if (!canShowVersionPicker) return
    if (consumerOnVersionPickerPress) {
      await consumerOnVersionPickerPress(data)
      return
    }
    if (Platform.OS === 'web') return
    setIsVersionPickerOpen(true)
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
          showVersionPicker={canShowVersionPicker}
          versionPickerRequiresLanguageId={consumerOnVersionPickerPress != null}
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
  // Matches Web BibleCardHeaderReference: 12px uppercase bold tracked.
  referenceTitle: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  // Web `yv:w-full` when the shell itself is the content measure.
  defaultInner: {
    width: '100%',
    gap: 24,
  },
  // Web `yv:card-content` for maxWidth="100%": full-bleed shell, 600px column.
  fullBleedInner: {
    width: '100%',
    maxWidth: FULL_BLEED_INNER_MAX_WIDTH,
    alignSelf: 'center',
    gap: 24,
  },
  footer: {
    justifyContent: 'space-between',
  },
  // Matches Web BibleCard copyright: 8px bold.
  copyright: {
    flex: 1,
    flexShrink: 1,
    fontSize: 8,
    lineHeight: 12,
  },
  attribution: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
})
