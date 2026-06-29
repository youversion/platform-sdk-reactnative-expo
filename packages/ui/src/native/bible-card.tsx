import { useControllableState } from '@radix-ui/react-use-controllable-state'
import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import type { BibleVersionPickerPressData, FootnoteData } from '@youversion/platform-react-ui'
import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { useShallow } from 'zustand/react/shallow'
import type { BibleCardProps as BibleCardDOMProps } from '../dom/bible-card'
import BibleCardDOM from '../dom/bible-card'
import FootnoteContent from '../dom/footnote-content'
import { withEmbedDomDefaults, withSheetDomDefaults } from '../lib'
import { useBibleCardVersionStore } from '../stores/bible-card-version-store'
import { BibleVersionPickerSheet } from './bible-version-picker-sheet'
import { NativeSheet } from './native-sheet'
import { useTheme } from '../hooks/use-theme'

const DEFAULT_VERSION_ID = 3034

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
> & {
  theme?: 'light' | 'dark' | 'system'
  versionId?: number
  defaultVersionId?: number
  onVersionChange?: (versionId: number) => void
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  onFootnotePress?: (data: FootnoteData) => Promise<void>
}

export function BibleCard({
  theme: themeOverride,
  versionId: controlledVersionId,
  defaultVersionId = DEFAULT_VERSION_ID,
  onVersionChange,
  onVersionPickerPress: consumerOnVersionPickerPress,
  onFootnotePress: consumerOnFootnotePress,
  showVersionPicker = true,
  dom,
  ...props
}: BibleCardProps) {
  const context = useYouVersion()
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
    onChange: onVersionChange,
  })

  useEffect(() => {
    if (isControlled || versionId == null) return
    setStoredVersionId(versionId)
  }, [versionId, isControlled, setStoredVersionId])

  const [footnoteData, setFootnoteData] = useState<FootnoteData | null>(null)
  const [isVersionPickerOpen, setIsVersionPickerOpen] = useState(false)

  const handleVersionChange = useCallback(
    async (newVersionId: number) => {
      setVersionId(newVersionId)
    },
    [setVersionId],
  )

  const handleVersionPickerPress = useCallback(
    async (_data: BibleVersionPickerPressData) => {
      if (Platform.OS === 'web') return
      if (!showVersionPicker) return
      if (consumerOnVersionPickerPress) {
        await consumerOnVersionPickerPress(_data)
      } else {
        setIsVersionPickerOpen(true)
      }
    },
    [consumerOnVersionPickerPress, showVersionPicker],
  )

  const handleFootnotePress = useCallback(async (data: FootnoteData) => {
    setFootnoteData(data)
  }, [])

  const onFootnotePress =
    Platform.OS !== 'web' ? (consumerOnFootnotePress ?? handleFootnotePress) : undefined

  const showVersionPickerSheet =
    Platform.OS !== 'web' && showVersionPicker && !consumerOnVersionPickerPress
  const showFootnoteSheet = Platform.OS !== 'web' && !consumerOnFootnotePress

  return (
    <>
      <BibleCardDOM
        {...props}
        dom={withEmbedDomDefaults(dom)}
        appKey={context.appKey}
        apiHost={context.apiHost}
        installationId={context.installationId}
        theme={resolvedTheme}
        versionId={versionId}
        onVersionChange={handleVersionChange}
        onVersionPickerPress={handleVersionPickerPress}
        onFootnotePress={onFootnotePress}
        showVersionPicker={showVersionPicker}
      />
      {showVersionPickerSheet && (
        <BibleVersionPickerSheet
          isOpen={isVersionPickerOpen}
          onClose={() => setIsVersionPickerOpen(false)}
          versionId={versionId}
          theme={resolvedTheme}
          onSelect={async (newVersionId) => {
            setVersionId(newVersionId)
          }}
        />
      )}
      {showFootnoteSheet && (
        <NativeSheet
          isOpen={!!footnoteData}
          onClose={() => setFootnoteData(null)}
          showAndroidLoader
          theme={resolvedTheme}
        >
          <FootnoteContent
            dom={withSheetDomDefaults()}
            data={footnoteData ?? EMPTY_FOOTNOTE}
            theme={resolvedTheme}
            appKey={context.appKey}
            apiHost={context.apiHost}
            installationId={context.installationId}
          />
        </NativeSheet>
      )}
    </>
  )
}
