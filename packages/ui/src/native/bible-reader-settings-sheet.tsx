import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { createBibleThemeSettingsContentHandlers } from '@youversion/platform-react-ui'
import { useMemo } from 'react'
import BibleReaderSettingsDOM from '../dom/bible-reader-settings'
import { useReaderSettingsStore } from '../stores/reader-settings-store'
import { NativeSheet } from './native-sheet'
import { useTheme } from '../hooks/use-theme'

export type BibleReaderSettingsSheetProps = {
  isSettingsSheetOpen: boolean
  onClose: () => void
}

export function BibleReaderSettingsSheet({
  isSettingsSheetOpen,
  onClose,
}: BibleReaderSettingsSheetProps) {
  const { appKey } = useYouVersion()
  const theme = useTheme()
  const { setFontFamily, setFontSize, fontSize, fontFamily } = useReaderSettingsStore()

  const { onFontIncreased, onFontDecreased, onFontSelected } = useMemo(
    () =>
      createBibleThemeSettingsContentHandlers({
        getFontSize: () => useReaderSettingsStore.getState().fontSize,
        getFontFamily: () => useReaderSettingsStore.getState().fontFamily,
        setFontSize,
        setFontFamily,
      }),
    [setFontSize, setFontFamily],
  )

  return (
    <NativeSheet isOpen={isSettingsSheetOpen} onClose={onClose} showAndroidLoader theme={theme}>
      <BibleReaderSettingsDOM
        dom={{ matchContents: true }}
        appKey={appKey}
        theme={theme}
        fontSize={fontSize}
        fontFamily={fontFamily}
        onFontIncreased={onFontIncreased}
        onFontDecreased={onFontDecreased}
        onFontSelected={onFontSelected}
      />
    </NativeSheet>
  )
}
