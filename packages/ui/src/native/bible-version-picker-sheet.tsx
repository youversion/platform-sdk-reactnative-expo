import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useState } from 'react'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native'
import VersionPickerContentDOM from '../dom/bible-version-picker-content'
import { useTheme } from '../hooks/use-theme'
import { SHEET_MUTED_BACKGROUND } from '../lib/native-sheet-theme'
import { NativeSheet } from './native-sheet'

const DEFAULT_VERSION_ID = 3034

export type BibleVersionPickerSheetProps = {
  isOpen: boolean
  onClose: () => void
  versionId?: number
  theme?: 'light' | 'dark' | 'system'
  onSelect?: (versionId: number) => void | Promise<void>
  dom?: import('expo/dom').DOMProps
}

export function BibleVersionPickerSheet({
  isOpen,
  onClose,
  versionId = DEFAULT_VERSION_ID,
  theme: themeOverride,
  onSelect,
  dom,
}: BibleVersionPickerSheetProps) {
  const context = useYouVersion()
  const { t } = useSdkTranslation()
  const resolvedTheme = useTheme(themeOverride)
  const { height } = useWindowDimensions()

  // Bump resetKey on each open so the DOM component remounts its picker tree,
  // resetting scroll position, search query, and language filter state. Detect
  // the closed->open transition by comparing isOpen against its previous value
  // during render (not in an effect), so the new resetKey flows straight into
  // the child on the same commit without a stale intermediate frame.
  // See https://react.dev/learn/you-might-not-need-an-effect
  const [resetKey, setResetKey] = useState(0)
  const [wasOpen, setWasOpen] = useState(false)
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen)
    if (isOpen) setResetKey((k) => k + 1)
  }

  if (Platform.OS === 'web') return null

  const pickerDom = {
    style: styles.dom,
    hideKeyboardAccessoryView: true,
    scrollEnabled: false,
    ...dom,
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

  return (
    <NativeSheet
      isOpen={isOpen}
      onClose={onClose}
      enableContentPanningGesture={false}
      theme={resolvedTheme}
      bottomInsetColor={SHEET_MUTED_BACKGROUND[resolvedTheme]}
      contentStyle={styles.content}
      showHeader={true}
      headerTitle={t('bibleVersionsHeading')}
    >
      <View style={[styles.componentContent, { height: Math.round(height * 0.78) }]}>
        <VersionPickerContentDOM
          dom={pickerDom}
          appKey={context.appKey}
          versionId={versionId}
          theme={resolvedTheme}
          resetKey={resetKey}
          isOpen={isOpen}
          onVersionChange={handleVersionChange}
        />
      </View>
    </NativeSheet>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0,
  },
  componentContent: {
    width: '100%',
  },
  dom: {
    flex: 1,
  },
})
