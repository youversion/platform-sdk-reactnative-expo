import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import type { BibleChapterPickerSelectData } from '@youversion/platform-react-ui'
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native'
import ChapterPickerContentDOM from '../dom/chapter-picker-content'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
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
      headerTitle={t('books')}
    >
      <View style={[styles.componentContent, { height: Math.round(height * 0.78) }]}>
        <ChapterPickerContentDOM
          dom={pickerDom}
          appKey={context.appKey}
          book={book}
          chapter={chapter}
          versionId={versionId}
          theme={resolvedTheme}
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
