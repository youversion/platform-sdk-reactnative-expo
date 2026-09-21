import type { BibleChapterPickerSelectData } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useTheme } from '../hooks/use-theme'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { DEFAULT_BIBLE_VERSION_ID } from '../lib/constants'
import { SHEET_SURFACE } from '../lib/native-sheet-theme'
import { getImpl, registerDefault } from './component-impls'
import './bible-chapter-picker'
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
}

function BibleChapterPickerSheetImpl({
  isOpen,
  onClose,
  book = DEFAULT_BOOK,
  chapter = DEFAULT_CHAPTER,
  versionId = DEFAULT_BIBLE_VERSION_ID,
  theme: themeOverride,
  onSelect,
}: BibleChapterPickerSheetProps) {
  const { t } = useSdkTranslation()
  const resolvedTheme = useTheme(themeOverride)
  const { height } = useWindowDimensions()

  if (Platform.OS === 'web') return null

  const handleSelect = async (data: BibleChapterPickerSelectData) => {
    await onSelect?.(data)
    onClose()
  }

  const Picker = getImpl('BibleChapterPicker')

  return (
    <NativeSheet
      isOpen={isOpen}
      onClose={onClose}
      enableContentPanningGesture={false}
      theme={resolvedTheme}
      bottomInsetColor={SHEET_SURFACE[resolvedTheme]}
      contentStyle={styles.content}
      showHeader={true}
      headerTitle={t('booksHeading')}
    >
      <View style={[styles.componentContent, { height: Math.round(height * 0.78) }]}>
        {isOpen ? (
          <Picker book={book} chapter={chapter} versionId={versionId} onSelect={handleSelect} />
        ) : null}
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
})
