import { useEffect, useRef } from 'react'
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native'
import VersionPickerContentDOM from '../dom/bible-version-picker-content'
import { NativeSheet } from './native-sheet'
import { useYouVersion } from './youversion-provider'

const DEFAULT_VERSION_ID = 3034
const MUTED_BACKGROUND = {
  light: '#f6f4f4',
  dark: '#353333',
}

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
  const { height } = useWindowDimensions()

  // Bump resetKey on each open so the DOM component remounts its picker tree,
  // resetting scroll position, search query, and language filter state
  const resetKeyRef = useRef(0)
  useEffect(() => {
    if (isOpen) resetKeyRef.current += 1
  }, [isOpen])

  if (Platform.OS === 'web') return null

  const resolvedTheme =
    themeOverride === 'system' ? context.theme : (themeOverride ?? context.theme)
  const pickerDom = {
    style: styles.dom,
    hideKeyboardAccessoryView: true,
    scrollEnabled: false,
    ...dom,
  }

  const handleVersionChange = async (newVersionId: number) => {
    if (onSelect) {
      try {
        await Promise.resolve(onSelect(newVersionId))
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
      contentStyle={[
        styles.content,
        {
          backgroundColor: MUTED_BACKGROUND[resolvedTheme],
        },
      ]}
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
