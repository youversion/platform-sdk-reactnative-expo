import { useControllableState } from '@radix-ui/react-use-controllable-state'
import { useYouVersion, type Highlight } from '@youversion/platform-react-native-expo-core'
import type { BibleVersionPickerPressData, FootnoteData } from '@youversion/platform-react-ui'
import { useState, type ReactNode } from 'react'
import { Platform } from 'react-native'
import { useShallow } from 'zustand/react/shallow'
import type { BibleCardProps as BibleCardDOMProps } from '../dom/bible-card'
import { getImpl } from './component-impls'
import { DEFAULT_BIBLE_VERSION_ID } from '../lib/constants'
import { withEmbedDomDefaults, withSheetDomDefaults } from '../lib/embed-dom-props'
import type { InternalLocaleProps } from '../lib/locale-props'
import type { InternalVersionFilterProps } from '../lib/version-filter-props'
import { useBibleCardVersionStore } from '../stores/bible-card-version-store'
import { BibleVersionPickerSheet } from './bible-version-picker-sheet'
import { HighlightsPaint } from './highlights-paint'
import { highlightScopeFor } from './highlight-scope'
import { NativeSheet } from './native-sheet'
import { useTheme, type Theme } from '../hooks/use-theme'
import { useLocale } from '../i18n/locale-context'

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
    resolvedTheme: Theme
    versionId: number | undefined
    onVersionChange: (newVersionId: number) => Promise<void>
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

function BibleCardBody({
  highlights,
  appKey,
  apiHost,
  installationId,
  permittedVersionIds,
  excludedVersionIds,
  permittedLanguageTags,
  locale,
  resolvedTheme,
  versionId,
  onVersionChange,
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
  ...props
}: BibleCardBodyProps): ReactNode {
  const BibleCardDOM = getImpl('BibleCardDom')
  const FootnoteContent = getImpl('FootnoteContent')

  return (
    <>
      <BibleCardDOM
        {...props}
        highlights={highlights}
        dom={withEmbedDomDefaults(dom)}
        appKey={appKey}
        apiHost={apiHost}
        installationId={installationId}
        permittedVersionIds={permittedVersionIds}
        excludedVersionIds={excludedVersionIds}
        permittedLanguageTags={permittedLanguageTags}
        locale={locale}
        theme={resolvedTheme}
        versionId={versionId}
        onVersionChange={onVersionChange}
        onVersionPickerPress={onVersionPickerPress}
        onFootnotePress={onFootnotePress}
        showVersionPicker={showVersionPicker}
      />
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
    </>
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

  const handleVersionChange = async (newVersionId: number) => {
    setVersionId(newVersionId)
  }

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
          permittedVersionIds={context.permittedVersionIds}
          excludedVersionIds={context.excludedVersionIds}
          permittedLanguageTags={context.permittedLanguageTags}
          locale={lng}
          resolvedTheme={resolvedTheme}
          versionId={versionId}
          onVersionChange={handleVersionChange}
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
