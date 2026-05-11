import { Platform } from 'react-native'
import type { BibleChapterPickerSelectData } from '@youversion/platform-react-ui'
import ChapterPickerContentDOM from '../dom/chapter-picker-content'
import { NativeSheet } from './native-sheet'
import { useYouVersion } from './youversion-provider'

const DEFAULT_BOOK = 'JHN'
const DEFAULT_CHAPTER = '1'
const DEFAULT_VERSION_ID = 3034

export type BibleChapterPickerSheetProps = {
  isOpen: boolean
  onClose: () => void

  book?: string
  defaultBook?: string
  onBookChange?: (book: string) => void | Promise<void>

  chapter?: string
  defaultChapter?: string
  onChapterChange?: (chapter: string) => void | Promise<void>

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
  onBookChange,
  onChapterChange,
  versionId = DEFAULT_VERSION_ID,
  theme: themeOverride,
  onSelect,
  dom,
}: BibleChapterPickerSheetProps) {
  if (Platform.OS === 'web') return null

  const context = useYouVersion()
  const resolvedTheme =
    themeOverride === 'system'
      ? context.theme
      : (themeOverride ?? context.theme)

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
    <NativeSheet isOpen={isOpen} onClose={onClose}>
      <ChapterPickerContentDOM
        dom={dom ?? { matchContents: true }}
        appKey={context.appKey}
        book={book}
        chapter={chapter}
        versionId={versionId}
        theme={resolvedTheme}
        onSelect={handleSelect}
      />
    </NativeSheet>
  )
}
