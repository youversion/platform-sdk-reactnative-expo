import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import type { BibleChapterPickerSelectData } from '@youversion/platform-react-ui'
import type { DOMProps } from 'expo/dom'
import { useState, type ReactNode } from 'react'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useTheme } from '../hooks/use-theme'
import { DEFAULT_BIBLE_VERSION_ID } from '../lib/constants'
import { SHEET_MUTED_BACKGROUND } from '../lib/native-sheet-theme'
import { getImpl, registerDefault } from './component-impls'
import { NativeSheet } from './native-sheet'

const DEFAULT_BOOK = 'JHN'
const DEFAULT_CHAPTER = '1'

export type BibleChapterPickerSheetProps = {
  isOpen: boolean
  onClose: () => void

  book?: string
  chapter?: string
  versionId?: number

  theme?: 'light' | 'dark' | 'system'
  onSelect?: (data: BibleChapterPickerSelectData) => void | Promise<void>
  dom?: DOMProps
}

function BibleChapterPickerSheetImpl({
  isOpen,
  onClose,
  book = DEFAULT_BOOK,
  chapter = DEFAULT_CHAPTER,
  versionId = DEFAULT_BIBLE_VERSION_ID,
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
  const handleDismissKeyboardStart = () => {
    setDismissKeyboardNonce((n) => n + 1)
  }

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

  const ChapterPickerContentDOM = getImpl('ChapterPickerContent')

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
          permittedVersionIds={context.permittedVersionIds}
          excludedVersionIds={context.excludedVersionIds}
          permittedLanguageTags={context.permittedLanguageTags}
        />
      </View>
    </NativeSheet>
  )
}

registerDefault('BibleChapterPickerSheet', BibleChapterPickerSheetImpl)

export function BibleChapterPickerSheet(props: BibleChapterPickerSheetProps): ReactNode {
  const Impl = getImpl('BibleChapterPickerSheet')
  return <Impl {...props} />
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
