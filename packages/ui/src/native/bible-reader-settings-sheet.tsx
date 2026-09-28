import { createBibleThemeSettingsContentHandlers } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'

import { ThemeContext, useTheme } from '../hooks/use-theme'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { SHEET_SURFACE } from '../lib/native-sheet-theme'
import type { ThemeInput } from '../lib/resolve-theme'
import { useReaderSettingsStore } from '../stores/reader-settings-store'
import { getImpl, registerDefault } from './component-impls'
import { BibleReaderSettingsContent } from './bible-reader-settings-content'
import { NativeSheet } from './native-sheet'

export type BibleReaderSettingsSheetProps = {
  isSettingsSheetOpen: boolean
  onClose: () => void
  theme?: ThemeInput
}

function BibleReaderSettingsSheetImpl({
  isSettingsSheetOpen,
  onClose,
  theme: themeOverride,
}: BibleReaderSettingsSheetProps) {
  const { t } = useSdkTranslation()
  const theme = useTheme(themeOverride)
  const { setFontFamily, setFontSize, setLineSpacing, fontSize, fontFamily, lineSpacing } =
    useReaderSettingsStore()

  const { onFontIncreased, onFontDecreased, onFontSelected, onChangeLineSpacing } =
    createBibleThemeSettingsContentHandlers({
      getFontSize: () => useReaderSettingsStore.getState().fontSize,
      getFontFamily: () => useReaderSettingsStore.getState().fontFamily,
      getLineSpacing: () => useReaderSettingsStore.getState().lineSpacing,
      setFontSize,
      setFontFamily,
      setLineSpacing,
    })

  return (
    <NativeSheet
      isOpen={isSettingsSheetOpen}
      onClose={onClose}
      theme={theme}
      bottomInsetColor={SHEET_SURFACE[theme]}
      showHeader
      headerTitle={t('fontAndSettings')}
    >
      <ThemeContext.Provider value={theme}>
        <BibleReaderSettingsContent
          fontSize={fontSize}
          fontFamily={fontFamily}
          lineSpacing={lineSpacing}
          onFontIncreased={onFontIncreased}
          onFontDecreased={onFontDecreased}
          onFontSelected={onFontSelected}
          onChangeLineSpacing={onChangeLineSpacing}
        />
      </ThemeContext.Provider>
    </NativeSheet>
  )
}

registerDefault('BibleReaderSettingsSheet', BibleReaderSettingsSheetImpl)

export function BibleReaderSettingsSheet(props: BibleReaderSettingsSheetProps): ReactNode {
  const Impl = getImpl('BibleReaderSettingsSheet')
  return <Impl {...props} />
}
