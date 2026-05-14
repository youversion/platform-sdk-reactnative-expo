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
  | 'theme'
> & {
  theme?: 'light' | 'dark' | 'system'
  defaultBook?: string
  defaultChapter?: string
  defaultVersionId?: number
  // Expo DOM calls cross a runtime boundary (native <-> WebView), so function props are always async "native actions".
  onFootnotePress?: (data: FootnoteData) => Promise<void>
}

export function BibleReader({
  theme,
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
  const resolvedTheme = theme === 'system' ? context.theme : (theme ?? context.theme)

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

  const handleBookChange = useCallback(async (b: string) => {
    setBook(b)
  }, [setBook])

  const handleChapterChange = useCallback(async (c: string) => {
    setChapter(c)
  }, [setChapter])

  const handleVersionChange = useCallback(async (id: number) => {
    setVersionId(id)
  }, [setVersionId])

  const onFootnotePress =
    Platform.OS !== 'web'
      ? (consumerOnFootnotePress ??
        (async (data: FootnoteData) => {
          setFootnoteData(data)
          setFootnoteOpenKey((key) => key + 1)
        }))
      : undefined

  const handleChapterPickerPress = useCallback(
    async (data: BibleChapterPickerPressData) => {
      if (Platform.OS === 'web' || !showToolbar) return
      if (consumerOnChapterPickerPress) {
        await consumerOnChapterPickerPress(data)
      } else {
        setIsPickerOpen(true)
      }
    },
    [consumerOnChapterPickerPress, showToolbar],
  )

  const showFootnoteSheet = Platform.OS !== 'web' && !consumerOnFootnotePress
  const showPickerSheet = Platform.OS !== 'web' && showToolbar && !consumerOnChapterPickerPress

  return (
    <>
      <BibleReaderDOM
        appKey={context.appKey}
        theme={resolvedTheme}
        book={book}
        chapter={chapter}
        versionId={versionId}
        fontSize={fontSize}
        fontFamily={fontFamily}
        onFontSizeChange={setFontSize}
        onFontFamilyChange={setFontFamily}
        onOpenBibleThemeSettings={Platform.OS !== 'web' ? handleOpenBibleThemeSettings : undefined}
        onBookChange={handleBookChange}
        onChapterChange={handleChapterChange}
        onVersionChange={handleVersionChange}
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
            theme={resolvedTheme}
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
          theme={resolvedTheme}
          onSelect={async (data) => {
            setBook(data.book)
            setChapter(data.chapter)
            setVersionId(data.versionId)
          }}
        />
      )}
    </>
  )
}
