import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useEffect, useState } from 'react'
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
  const resolvedTheme = useTheme(themeOverride)
  const { height } = useWindowDimensions()

  // Bump resetKey on each open so the DOM component remounts its picker tree,
  // resetting scroll position, search query, and language filter state. Kept in
  // state (not a ref) so the new value flows through render into resetKey
  // without reading a ref during render (react-hooks/refs). The setState here
  // is the "reset on prop change" flow; suppressing set-state-in-effect because
  // the alternative (ref + render read) trips react-hooks/refs instead.
  const [resetKey, setResetKey] = useState(0)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOpen) setResetKey((k) => k + 1)
  }, [isOpen])

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
      backgroundColor={SHEET_MUTED_BACKGROUND[resolvedTheme]}
      contentStyle={[
        styles.content,
        {
          backgroundColor: SHEET_MUTED_BACKGROUND[resolvedTheme],
        },
      ]}
      showHeader={true}
      headerTitle="Versions"
    >
      <View style={[styles.componentContent, { height: Math.round(height * 0.78) }]}>
        <VersionPickerContentDOM
          dom={pickerDom}
          appKey={context.appKey}
          versionId={versionId}
          theme={resolvedTheme}
          resetKey={resetKey}
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
