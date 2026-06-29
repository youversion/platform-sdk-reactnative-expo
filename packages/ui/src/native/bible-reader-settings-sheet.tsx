import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { createBibleThemeSettingsContentHandlers } from '@youversion/platform-react-ui'
import { useMemo } from 'react'
import BibleReaderSettingsDOM from '../dom/bible-reader-settings'
import { withSheetDomDefaults } from '../lib'
import { encodeFontFamilyForDom } from '../lib/reader-fonts'
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
  const { setFontFamily, setFontSize, setLineSpacing, fontSize, fontFamily, lineSpacing } =
    useReaderSettingsStore()

  const { onFontIncreased, onFontDecreased, onFontSelected, onChangeLineSpacing } = useMemo(
    () =>
      createBibleThemeSettingsContentHandlers({
        getFontSize: () => useReaderSettingsStore.getState().fontSize,
        getFontFamily: () => useReaderSettingsStore.getState().fontFamily,
        getLineSpacing: () => useReaderSettingsStore.getState().lineSpacing,
        setFontSize,
        setFontFamily,
        setLineSpacing,
      }),
    [setFontSize, setFontFamily, setLineSpacing],
  )

  return (
    <NativeSheet isOpen={isSettingsSheetOpen} onClose={onClose} showAndroidLoader theme={theme}>
      <BibleReaderSettingsDOM
        dom={withSheetDomDefaults()}
        appKey={appKey}
        theme={theme}
        fontSize={fontSize}
        fontFamily={encodeFontFamilyForDom(fontFamily)}
        lineSpacing={lineSpacing}
        onFontIncreased={onFontIncreased}
        onFontDecreased={onFontDecreased}
        onFontSelected={onFontSelected}
        onLineSpacingChange={onChangeLineSpacing}
      />
    </NativeSheet>
  )
}
