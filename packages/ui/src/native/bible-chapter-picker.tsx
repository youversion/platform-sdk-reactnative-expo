import type { BibleChapterPickerSelectData } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

import { ChapterPickerContent } from '../components/bible/chapter-picker-content'
import { useChapterPicker } from '../components/bible/use-chapter-picker'
import { DEFAULT_BIBLE_VERSION_ID } from '../lib/constants'
import { getImpl, registerDefault } from './component-impls'

const DEFAULT_BOOK = 'JHN'
const DEFAULT_CHAPTER = '1'

export type BibleChapterPickerProps = {
  book?: string
  chapter?: string
  versionId?: number
  onSelect?: (data: BibleChapterPickerSelectData) => void | Promise<void>
  style?: StyleProp<ViewStyle>
}

function BibleChapterPickerImpl({
  book = DEFAULT_BOOK,
  chapter = DEFAULT_CHAPTER,
  versionId = DEFAULT_BIBLE_VERSION_ID,
  onSelect,
  style,
}: BibleChapterPickerProps): ReactNode {
  const controller = useChapterPicker({ book, versionId, onSelect })

  return (
    <ChapterPickerContent
      loadState={controller.loadState}
      books={controller.visibleBooks}
      selectedBook={book}
      selectedChapter={chapter}
      query={controller.query}
      order={controller.order}
      expandedBookId={controller.expandedBookId}
      pendingChapterId={controller.pendingChapterId}
      style={style}
      onQueryChange={controller.setQuery}
      onOrderChange={controller.setOrder}
      onExpandedBookChange={controller.setExpandedBookId}
      onRetry={controller.retry}
      onSelectChapter={(selectedBook, selectedChapter) => {
        void controller.selectChapter(selectedBook, selectedChapter)
      }}
    />
  )
}

registerDefault('BibleChapterPicker', BibleChapterPickerImpl)

export function BibleChapterPicker(props: BibleChapterPickerProps): ReactNode {
  const Impl = getImpl('BibleChapterPicker')
  return <Impl {...props} />
}
