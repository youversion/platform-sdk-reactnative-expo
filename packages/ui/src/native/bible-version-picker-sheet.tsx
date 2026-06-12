import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useEffect, useRef } from 'react'
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
  // resetting scroll position, search query, and language filter state
  const resetKeyRef = useRef(0)
  useEffect(() => {
    if (isOpen) resetKeyRef.current += 1
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
      // Pre-warmed: the version list is fetched over the network, so the
      // WebView stays mounted to hide data latency, not WebView cold start.
      keepMounted
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
          resetKey={resetKeyRef.current}
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
