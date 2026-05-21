import { useControllableState } from '@radix-ui/react-use-controllable-state'
import { useState, useCallback } from 'react'
import { Platform } from 'react-native'
import BibleCardDOM from '../dom/bible-card'
import type { BibleCardProps as BibleCardDOMProps } from '../dom/bible-card'
import FootnoteContent from '../dom/footnote-content'
import { BibleVersionPickerSheet } from './bible-version-picker-sheet'
import { NativeSheet } from './native-sheet'
import { useYouVersion } from './youversion-provider'
import type { BibleVersionPickerPressData, FootnoteData } from '@youversion/platform-react-ui'

const DEFAULT_VERSION_ID = 3034

const EMPTY_FOOTNOTE: FootnoteData = {
  verseNum: '',
  notes: [],
  verseHtml: '',
}

export type BibleCardProps = Omit<
  BibleCardDOMProps,
  'appKey' | 'onVersionChange' | 'onVersionPickerPress' | 'onFootnotePress' | 'theme' | 'versionId'
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
  ...props
}: BibleCardProps) {
  const context = useYouVersion()
  const resolvedTheme =
    themeOverride === 'system' ? context.theme : (themeOverride ?? context.theme)

  // This mimics how it's done in the React Web SDK.
  // Controlled only when both versionId + onVersionChange are provided.
  // versionId alone seeds uncontrolled state, preserving backwards compatibility
  // with consumers who use the version picker without an onChange handler.
  const isControlled = controlledVersionId !== undefined && onVersionChange !== undefined

  const [versionId, setVersionId] = useControllableState({
    prop: isControlled ? controlledVersionId : undefined,
    defaultProp: isControlled ? defaultVersionId : (controlledVersionId ?? defaultVersionId),
    onChange: onVersionChange,
  })

  const [footnoteData, setFootnoteData] = useState<FootnoteData | null>(null)
  // footnoteData can remain non-null across repeated taps, so track each tap as an open event.
  const [footnoteOpenKey, setFootnoteOpenKey] = useState(0)
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

  const onFootnotePress =
    Platform.OS !== 'web'
      ? (consumerOnFootnotePress ??
        (async (data: FootnoteData) => {
          setFootnoteData(data)
          setFootnoteOpenKey((key) => key + 1)
        }))
      : undefined

  const showVersionPickerSheet =
    Platform.OS !== 'web' && showVersionPicker && !consumerOnVersionPickerPress
  const showFootnoteSheet = Platform.OS !== 'web' && !consumerOnFootnotePress

  return (
    <>
      <BibleCardDOM
        {...props}
        appKey={context.appKey}
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
          openKey={footnoteOpenKey}
          onClose={() => setFootnoteData(null)}
        >
          <FootnoteContent
            dom={{ matchContents: true }}
            data={footnoteData ?? EMPTY_FOOTNOTE}
            theme={resolvedTheme}
            appKey={context.appKey}
          />
        </NativeSheet>
      )}
    </>
  )
}
