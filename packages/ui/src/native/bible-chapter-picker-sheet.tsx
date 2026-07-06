import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import type { BibleChapterPickerSelectData } from '@youversion/platform-react-ui'
import { useCallback, useState } from 'react'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native'
import ChapterPickerContentDOM from '../dom/chapter-picker-content'
import { useTheme } from '../hooks/use-theme'
import { SHEET_MUTED_BACKGROUND } from '../lib/native-sheet-theme'
import { NativeSheet } from './native-sheet'

const DEFAULT_BOOK = 'JHN'
const DEFAULT_CHAPTER = '1'
const DEFAULT_VERSION_ID = 3034

export type BibleChapterPickerSheetProps = {
  isOpen: boolean
  onClose: () => void

  book?: string
  chapter?: string
  versionId?: number

  theme?: 'light' | 'dark' | 'system'
  onSelect?: (data: BibleChapterPickerSelectData) => void | Promise<void>
  dom?: import('expo/dom').DOMProps
}

export function BibleChapterPickerSheet({
  isOpen,
  onClose,
  book = DEFAULT_BOOK,
  chapter = DEFAULT_CHAPTER,
  versionId = DEFAULT_VERSION_ID,
  theme: themeOverride,
  onSelect,
  dom,
}: BibleChapterPickerSheetProps) {
  const context = useYouVersion()
  const { t } = useSdkTranslation()
  const resolvedTheme = useTheme(themeOverride)
  const { height } = useWindowDimensions()

  // Bump resetKey on close so the DOM component remounts its picker tree on the
  // dismiss transition, resetting scroll position, search query, and language
  // filter state before the next open. Done in the close handler (an event)
  // rather than an effect — see https://react.dev/learn/you-might-not-need-an-effect.
  const [resetKey, setResetKey] = useState(0)
  const [dismissKeyboardNonce, setDismissKeyboardNonce] = useState(0)
  const handleDismissKeyboardStart = useCallback(() => {
    setDismissKeyboardNonce((n) => n + 1)
  }, [])

  const handleClose = () => {
    setResetKey((k) => k + 1)
    onClose()
  }

  if (Platform.OS === 'web') return null

  const pickerDom = {
    style: styles.dom,
    hideKeyboardAccessoryView: true,
    scrollEnabled: false,
    ...dom,
  }

  const handleSelect = async (data: BibleChapterPickerSelectData) => {
    if (onSelect) {
      try {
        await Promise.resolve(onSelect(data))
      } catch {
        return
      }
    }
    handleClose()
  }

  return (
    <NativeSheet
      isOpen={isOpen}
      onClose={handleClose}
      onDismissKeyboardStart={handleDismissKeyboardStart}
      enableContentPanningGesture={false}
      theme={resolvedTheme}
      bottomInsetColor={SHEET_MUTED_BACKGROUND[resolvedTheme]}
      contentStyle={styles.content}
      showHeader={true}
      headerTitle={t('booksHeading')}
    >
      <View style={[styles.componentContent, { height: Math.round(height * 0.78) }]}>
        <ChapterPickerContentDOM
          dom={pickerDom}
          appKey={context.appKey}
          book={book}
          chapter={chapter}
          versionId={versionId}
          theme={resolvedTheme}
          isOpen={isOpen}
          dismissKeyboardNonce={dismissKeyboardNonce}
          resetKey={resetKey}
          onSelect={handleSelect}
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
