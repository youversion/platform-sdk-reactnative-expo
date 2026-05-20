import { useControllableState } from '@radix-ui/react-use-controllable-state'
import { useState, useCallback } from 'react'
import { Platform } from 'react-native'
import BibleCardDOM from '../dom/bible-card'
import type { BibleCardProps as BibleCardDOMProps } from '../dom/bible-card'
import { BibleVersionPickerSheet } from './bible-version-picker-sheet'
import { useYouVersion } from './youversion-provider'
import type { BibleVersionPickerPressData } from '@youversion/platform-react-ui'

const DEFAULT_VERSION_ID = 3034

export type BibleCardProps = Omit<
  BibleCardDOMProps,
  'appKey' | 'onVersionChange' | 'onVersionPickerPress' | 'theme' | 'versionId'
> & {
  theme?: 'light' | 'dark' | 'system'
  versionId?: number
  defaultVersionId?: number
  onVersionChange?: (versionId: number) => void
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
}

export function BibleCard({
  theme: themeOverride,
  versionId: controlledVersionId,
  defaultVersionId = DEFAULT_VERSION_ID,
  onVersionChange,
  onVersionPickerPress: consumerOnVersionPickerPress,
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

  const showVersionPickerSheet =
    Platform.OS !== 'web' && showVersionPicker && !consumerOnVersionPickerPress

  return (
    <>
      <BibleCardDOM
        {...props}
        appKey={context.appKey}
        theme={resolvedTheme}
        versionId={versionId}
        onVersionChange={handleVersionChange}
        onVersionPickerPress={handleVersionPickerPress}
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
    </>
  )
}
