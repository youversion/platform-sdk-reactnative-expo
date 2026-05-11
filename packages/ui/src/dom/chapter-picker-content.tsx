'use dom'

import {
  BibleChapterPicker,
  YouVersionProvider,
  type BibleChapterPickerSelectData,
} from '@youversion/platform-react-ui'

export type ChapterPickerContentDOMProps = {
  appKey: string
  book?: string
  chapter?: string
  versionId?: number
  theme?: 'light' | 'dark'
  onSelect?: (data: BibleChapterPickerSelectData) => Promise<void>
  dom?: import('expo/dom').DOMProps
}

export default function ChapterPickerContentDOM({
  appKey,
  book,
  chapter,
  versionId = 3034,
  theme = 'light',
  onSelect,
}: ChapterPickerContentDOMProps) {
  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <BibleChapterPicker.Root
        book={book}
        chapter={chapter}
        versionId={versionId}
        background={theme}
      >
        <BibleChapterPicker.Content onSelect={onSelect} />
      </BibleChapterPicker.Root>
    </YouVersionProvider>
  )
}
