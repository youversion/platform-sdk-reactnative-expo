import type { DOMProps } from 'expo/dom'
import { useState, type ReactNode } from 'react'
import { Keyboard, Platform, StyleSheet, View, useWindowDimensions } from 'react-native'
import { ThemeContext, useTheme } from '../hooks/use-theme'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { DEFAULT_BIBLE_VERSION_ID } from '../lib/constants'
import { SHEET_MUTED_BACKGROUND } from '../lib/native-sheet-theme'
import { getImpl, registerDefault } from './component-impls'
import './bible-version-picker'
import { NativeSheet } from './native-sheet'

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
  const { t } = useSdkTranslation()
  const resolvedTheme = useTheme(themeOverride)
  const { height } = useWindowDimensions()

  const [pickerKey, setPickerKey] = useState(0)
  const [wasOpen, setWasOpen] = useState(false)
  const [sheetOpenedNonce, setSheetOpenedNonce] = useState(0)
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen)
    if (isOpen) {
      setPickerKey((key) => key + 1)
      setSheetOpenedNonce((nonce) => nonce + 1)
    }
  }

  if (Platform.OS === 'web') return null

  const handleDismissKeyboardStart = () => {
    Keyboard.dismiss()
  }

  const handleVersionChange = async (newVersionId: number) => {
    if (onSelect) {
      try {
        await onSelect(newVersionId)
      } catch {
        return
      }
    }
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
      bottomInsetColor={SHEET_MUTED_BACKGROUND[resolvedTheme]}
      contentStyle={styles.content}
      showHeader={true}
      headerTitle={t('bibleVersionsHeading')}
    >
      <View style={[styles.componentContent, { height: Math.round(height * 0.78) }]}>
        {isOpen ? (
          <ThemeContext.Provider value={resolvedTheme}>
            <Picker
              key={pickerKey}
              versionId={versionId}
              sheetOpenedNonce={sheetOpenedNonce}
              onSelect={handleVersionChange}
            />
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
