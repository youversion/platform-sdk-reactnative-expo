import { useControllableState } from '@radix-ui/react-use-controllable-state'
import { useState } from 'react'
import { Platform } from 'react-native'
import BibleReaderDOM from '../dom/bible-reader'
import FootnoteContent from '../dom/footnote-content'
import { BibleChapterPickerSheet } from './bible-chapter-picker-sheet'
import { NativeSheet } from './native-sheet'
import { useYouVersion } from './youversion-provider'
import type { FootnoteData, BibleChapterPickerPressData } from '@youversion/platform-react-ui'

const EMPTY_FOOTNOTE: FootnoteData = {
  verseNum: '',
  notes: [],
  verseHtml: '',
}

const DEFAULT_BOOK = 'JHN'
const DEFAULT_CHAPTER = '1'
const DEFAULT_VERSION_ID = 3034

export type BibleReaderProps = {
  themeBackground?: 'light' | 'dark' | 'system'

  book?: string
  defaultBook?: string
  onBookChange?: (book: string) => void | Promise<void>

  chapter?: string
  defaultChapter?: string
  onChapterChange?: (chapter: string) => void | Promise<void>

  versionId?: number
  defaultVersionId?: number
  onVersionChange?: (versionId: number) => void | Promise<void>

  showToolbar?: boolean
  onChapterPickerPress?: (data: BibleChapterPickerPressData) => void | Promise<void>
  onFootnotePress?: (data: FootnoteData) => Promise<void>

  fontSize?: number
  fontFamily?: string
  backgroundColor?: string
  foregroundColor?: string
  dom?: import('expo/dom').DOMProps
}

export function BibleReader({
  themeBackground: themeBackgroundProp,
  book: controlledBook,
  defaultBook = DEFAULT_BOOK,
  onBookChange,
  chapter: controlledChapter,
  defaultChapter = DEFAULT_CHAPTER,
  onChapterChange,
  versionId: controlledVersionId,
  defaultVersionId = DEFAULT_VERSION_ID,
  onVersionChange,
  showToolbar = true,
  onChapterPickerPress: consumerOnChapterPickerPress,
  onFootnotePress: consumerOnFootnotePress,
  fontSize,
  fontFamily,
  backgroundColor,
  foregroundColor,
  dom,
}: BibleReaderProps) {
  const context = useYouVersion()
  const themeBackground =
    themeBackgroundProp === 'system'
      ? context.theme
      : (themeBackgroundProp ?? context.theme)

  const [book, setBook] = useControllableState({
    prop: controlledBook,
    defaultProp: defaultBook,
    onChange: onBookChange,
  })

  const [chapter, setChapter] = useControllableState({
    prop: controlledChapter,
    defaultProp: defaultChapter,
    onChange: onChapterChange,
  })

  const [versionId, setVersionId] = useControllableState({
    prop: controlledVersionId,
    defaultProp: defaultVersionId,
    onChange: onVersionChange,
  })

  const [footnoteData, setFootnoteData] = useState<FootnoteData | null>(null)
  const [footnoteOpenKey, setFootnoteOpenKey] = useState(0)
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  const onFootnotePress =
    Platform.OS !== 'web'
      ? (consumerOnFootnotePress ??
        (async (data: FootnoteData) => {
          setFootnoteData(data)
          setFootnoteOpenKey((key) => key + 1)
        }))
      : undefined

  const handleChapterPickerPress =
    Platform.OS !== 'web' && showToolbar
      ? (consumerOnChapterPickerPress
          ? async (data: BibleChapterPickerPressData) => {
              await Promise.resolve(consumerOnChapterPickerPress(data))
            }
          : async (_data: BibleChapterPickerPressData) => {
              setIsPickerOpen(true)
            })
      : undefined

  const showFootnoteSheet = Platform.OS !== 'web' && !consumerOnFootnotePress
  const showPickerSheet =
    Platform.OS !== 'web' && showToolbar && !consumerOnChapterPickerPress

  return (
    <>
      <BibleReaderDOM
        appKey={context.appKey}
        themeBackground={themeBackground}
        book={book}
        chapter={chapter}
        versionId={versionId}
        onBookChange={async (b: string) => { setBook(b) }}
        onChapterChange={async (c: string) => { setChapter(c) }}
        onVersionChange={async (id: number) => { setVersionId(id) }}
        showToolbar={showToolbar}
        onChapterPickerPress={handleChapterPickerPress}
        onFootnotePress={onFootnotePress}
        fontSize={fontSize}
        fontFamily={fontFamily}
        backgroundColor={backgroundColor}
        foregroundColor={foregroundColor}
        dom={dom}
      />
      {showFootnoteSheet && (
        <NativeSheet
          isOpen={!!footnoteData}
          openKey={footnoteOpenKey}
          onClose={() => setFootnoteData(null)}
        >
          <FootnoteContent
            dom={{ matchContents: true }}
            data={footnoteData ?? EMPTY_FOOTNOTE}
            theme={themeBackground}
            fontSize={fontSize}
            appKey={context.appKey}
          />
        </NativeSheet>
      )}
      {showPickerSheet && (
        <BibleChapterPickerSheet
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          book={book}
          chapter={chapter}
          versionId={versionId}
          theme={themeBackgroundProp ?? context.theme}
          onSelect={async (data) => {
            setBook(data.book)
            setChapter(data.chapter)
          }}
        />
      )}
    </>
  )
}
