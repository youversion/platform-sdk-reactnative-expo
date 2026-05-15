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
  'appKey' | 'onVersionChange' | 'onVersionPickerPress' | 'theme'
> & {
  theme?: 'light' | 'dark' | 'system'
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

  const [versionId, setVersionId] = useControllableState({
    prop: controlledVersionId,
    defaultProp: defaultVersionId,
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
      if (consumerOnVersionPickerPress) {
        await consumerOnVersionPickerPress(_data)
      } else {
        setIsVersionPickerOpen(true)
      }
    },
    [consumerOnVersionPickerPress],
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
