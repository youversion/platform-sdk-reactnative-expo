import type { DOMProps } from 'expo/dom'
import type { ReactNode } from 'react'
import { Keyboard, Platform, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ThemeContext, useTheme } from '../hooks/use-theme'
import { DEFAULT_BIBLE_VERSION_ID } from '../lib/constants'
import { getImpl, registerDefault } from './component-impls'
import './bible-version-picker'
import { NativeSheet } from './native-sheet'

// Gorhom's default handle is 24pt; leave another 16pt above the sheet.
const SHEET_TOP_CHROME = 40

export type BibleVersionPickerSheetProps = {
  isOpen: boolean
  onClose: () => void
  versionId?: number
  theme?: 'light' | 'dark' | 'system'
  onSelect?: (versionId: number) => void | Promise<void>
  dom?: DOMProps
}

function BibleVersionPickerSheetImpl({
  isOpen,
  onClose,
  versionId = DEFAULT_BIBLE_VERSION_ID,
  theme: themeOverride,
  onSelect,
}: BibleVersionPickerSheetProps) {
  const resolvedTheme = useTheme(themeOverride)
  const { height } = useWindowDimensions()
  const { top, bottom } = useSafeAreaInsets()

  if (Platform.OS === 'web') return null

  const handleDismissKeyboardStart = () => {
    Keyboard.dismiss()
  }

  const handleVersionChange = async (newVersionId: number) => {
    await onSelect?.(newVersionId)
    onClose()
  }

  const Picker = getImpl('BibleVersionPicker')

  return (
    <NativeSheet
      isOpen={isOpen}
      onClose={onClose}
      onDismissKeyboardStart={handleDismissKeyboardStart}
      enableContentPanningGesture={false}
      theme={resolvedTheme}
      contentStyle={styles.content}
    >
      <View
        style={[
          styles.componentContent,
          { height: Math.min(Math.round(height * 0.88), height - top - bottom - SHEET_TOP_CHROME) },
        ]}
      >
        {isOpen ? (
          <ThemeContext.Provider value={resolvedTheme}>
            <Picker versionId={versionId} onSelect={handleVersionChange} onClose={onClose} />
          </ThemeContext.Provider>
        ) : null}
      </View>
    </NativeSheet>
  )
}

registerDefault('BibleVersionPickerSheet', BibleVersionPickerSheetImpl)

export function BibleVersionPickerSheet(props: BibleVersionPickerSheetProps): ReactNode {
  const Impl = getImpl('BibleVersionPickerSheet')
  return <Impl {...props} />
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0,
  },
  componentContent: {
    width: '100%',
  },
})
