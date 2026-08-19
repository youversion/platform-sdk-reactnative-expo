import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { createBibleThemeSettingsContentHandlers } from '@youversion/platform-react-ui'
import { useMemo, type ReactNode } from 'react'
import { withSheetDomDefaults } from '../lib/embed-dom-props'
import { encodeFontFamilyForDom } from '../lib/reader-fonts'
import { useReaderSettingsStore } from '../stores/reader-settings-store'
import { getImpl, registerDefault } from './component-impls'
import { NativeSheet } from './native-sheet'
import { useTheme } from '../hooks/use-theme'

export type BibleReaderSettingsSheetProps = {
  isSettingsSheetOpen: boolean
  onClose: () => void
}

function BibleReaderSettingsSheetImpl({
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

  const BibleReaderSettingsDOM = getImpl('BibleReaderSettings')

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

registerDefault('BibleReaderSettingsSheet', BibleReaderSettingsSheetImpl)

export function BibleReaderSettingsSheet(props: BibleReaderSettingsSheetProps): ReactNode {
  const Impl = getImpl('BibleReaderSettingsSheet')
  return <Impl {...props} />
}
