import { useControllableState } from '@radix-ui/react-use-controllable-state'
import { useState, useCallback } from 'react'
import { Platform } from 'react-native'
import BibleReaderDOM from '../dom/bible-reader'
import FootnoteContent from '../dom/footnote-content'
import { BibleChapterPickerSheet } from './bible-chapter-picker-sheet'
import type { BibleReaderProps as DomBibleReaderProps } from '../dom/bible-reader'
import { useReaderSettingsStore } from '../stores/reader-settings-store'
import { BibleReaderSettingsSheet } from './bible-reader-settings-sheet'
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

export type BibleReaderProps = Omit<
  DomBibleReaderProps,
  | 'appKey'
  | 'fontSize'
  | 'fontFamily'
  | 'onFontSizeChange'
  | 'onFontFamilyChange'
  | 'onOpenBibleThemeSettings'
  | 'onFootnotePress'
> & {
  themeBackground?: 'light' | 'dark' | 'system'
  defaultBook?: string
  defaultChapter?: string
  defaultVersionId?: number
  // Expo DOM calls cross a runtime boundary (native <-> WebView), so function props are always async "native actions".
  onFootnotePress?: (data: FootnoteData) => Promise<void>
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
  backgroundColor,
  foregroundColor,
  dom,
}: BibleReaderProps) {
  const context = useYouVersion()
  const themeBackground =
    themeBackgroundProp === 'system' ? context.theme : (themeBackgroundProp ?? context.theme)

  const { setFontFamily, setFontSize, fontSize, fontFamily } = useReaderSettingsStore()

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

  // footnoteData can remain non-null across repeated taps, so track each tap as an open event.
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false)

  const handleOpenBibleThemeSettings = useCallback(() => {
    setIsSettingsSheetOpen(true)
  }, [])

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
      ? consumerOnChapterPickerPress
        ? async (data: BibleChapterPickerPressData) => {
            await Promise.resolve(consumerOnChapterPickerPress(data))
          }
        : async (_data: BibleChapterPickerPressData) => {
            setIsPickerOpen(true)
          }
      : undefined

  const showFootnoteSheet = Platform.OS !== 'web' && !consumerOnFootnotePress
  const showPickerSheet = Platform.OS !== 'web' && showToolbar && !consumerOnChapterPickerPress

  return (
    <>
      <BibleReaderDOM
        appKey={context.appKey}
        themeBackground={themeBackground}
        book={book}
        chapter={chapter}
        versionId={versionId}
        fontSize={fontSize}
        fontFamily={fontFamily}
        onFontSizeChange={setFontSize}
        onFontFamilyChange={setFontFamily}
        onOpenBibleThemeSettings={Platform.OS !== 'web' ? handleOpenBibleThemeSettings : undefined}
        onBookChange={async (b: string) => {
          setBook(b)
        }}
        onChapterChange={async (c: string) => {
          setChapter(c)
        }}
        onVersionChange={async (id: number) => {
          setVersionId(id)
        }}
        showToolbar={showToolbar}
        onChapterPickerPress={handleChapterPickerPress}
        onFootnotePress={onFootnotePress}
        backgroundColor={backgroundColor}
        foregroundColor={foregroundColor}
        dom={dom}
      />
      {Platform.OS !== 'web' && (
        <BibleReaderSettingsSheet
          isSettingsSheetOpen={isSettingsSheetOpen}
          onClose={() => setIsSettingsSheetOpen(false)}
        />
      )}
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
