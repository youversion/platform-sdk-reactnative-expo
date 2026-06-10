import { useControllableState } from '@radix-ui/react-use-controllable-state'
import { useYouVersion, useYVAuthOptional } from '@youversion/platform-react-native-expo-core'
import type {
  BibleChapterPickerPressData,
  BibleVersionPickerPressData,
  FootnoteData,
} from '@youversion/platform-react-ui'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { WebViewOpenWindowEvent } from 'react-native-webview/lib/WebViewTypes'
import { useShallow } from 'zustand/react/shallow'
import type { BibleReaderProps as DomBibleReaderProps } from '../dom/bible-reader'
import BibleReaderDOM from '../dom/bible-reader'
import FootnoteContent from '../dom/footnote-content'
import { useTheme } from '../hooks'
import { useReaderLocationStore } from '../stores/reader-location-store'
import { useReaderSettingsStore } from '../stores/reader-settings-store'
import { BibleChapterPickerSheet } from './bible-chapter-picker-sheet'
import { BibleReaderSettingsSheet } from './bible-reader-settings-sheet'
import { BibleVersionPickerSheet } from './bible-version-picker-sheet'
import { NativeSheet } from './native-sheet'

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
  | 'onVersionPickerPress'
  | 'theme'
  | 'style'
  | 'apiHost'
  | 'installationId'
  | 'accessToken'
  | 'onSignInPress'
  | 'onSignOutPress'
  | 'userInfo'
> & {
  theme?: 'light' | 'dark' | 'system'
  defaultBook?: string
  defaultChapter?: string
  defaultVersionId?: number
  onFootnotePress?: (data: FootnoteData) => Promise<void>
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  /**
   * Android draws edge-to-edge, so the reader pads itself down by the
   * safe-area top inset to clear the status bar. Set this if the consumer
   * already applies its own top inset (e.g. a `SafeAreaView` wrapper) to
   * avoid double spacing. No-op on iOS.
   */
  disableTopInset?: boolean
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
  onVersionPickerPress: consumerOnVersionPickerPress,
  onFootnotePress: consumerOnFootnotePress,
  backgroundColor,
  foregroundColor,
  disableTopInset = false,
  dom,
}: BibleReaderProps) {
  const context = useYouVersion()
  const auth = useYVAuthOptional()
  const accessToken = auth?.accessToken ?? null
  const userInfo = auth?.userInfo ?? null
  const signIn = auth?.signIn
  const signOut = auth?.signOut
  const resolvedTheme = useTheme(theme)

  const { setFontFamily, setFontSize, fontSize, fontFamily } = useReaderSettingsStore()

  const {
    book: storedBook,
    chapter: storedChapter,
    versionId: storedVersionId,
    setLocation,
  } = useReaderLocationStore(
    useShallow((s) => ({
      book: s.book,
      chapter: s.chapter,
      versionId: s.versionId,
      setLocation: s.setLocation,
    })),
  )

  const [book, setBook] = useControllableState({
    prop: controlledBook,
    defaultProp: controlledBook !== undefined ? defaultBook : (storedBook ?? defaultBook),
    onChange: onBookChange,
  })

  const [chapter, setChapter] = useControllableState({
    prop: controlledChapter,
    defaultProp:
      controlledChapter !== undefined ? defaultChapter : (storedChapter ?? defaultChapter),
    onChange: onChapterChange,
  })

  const [versionId, setVersionId] = useControllableState({
    prop: controlledVersionId,
    defaultProp:
      controlledVersionId !== undefined ? defaultVersionId : (storedVersionId ?? defaultVersionId),
    onChange: onVersionChange,
  })

  useEffect(() => {
    const readerLocationToPersist: { book?: string; chapter?: string; versionId?: number } = {}
    if (controlledBook === undefined && book != null) readerLocationToPersist.book = book
    if (controlledChapter === undefined && chapter != null) {
      readerLocationToPersist.chapter = chapter
    }
    if (controlledVersionId === undefined && versionId != null) {
      readerLocationToPersist.versionId = versionId
    }
    if (Object.keys(readerLocationToPersist).length > 0) setLocation(readerLocationToPersist)
  }, [
    book,
    chapter,
    versionId,
    controlledBook,
    controlledChapter,
    controlledVersionId,
    setLocation,
  ])

  const [footnoteData, setFootnoteData] = useState<FootnoteData | null>(null)
  // footnoteData can remain non-null across repeated taps, so track each tap as an open event.
  const [footnoteOpenKey, setFootnoteOpenKey] = useState(0)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isVersionPickerOpen, setIsVersionPickerOpen] = useState(false)
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false)

  const handleOpenBibleThemeSettings = useCallback(() => {
    setIsSettingsSheetOpen(true)
  }, [])

  const handleBookChange = useCallback(
    async (b: string) => {
      setBook(b)
    },
    [setBook],
  )

  const handleChapterChange = useCallback(
    async (c: string) => {
      setChapter(c)
    },
    [setChapter],
  )

  const handleVersionChange = useCallback(
    async (id: number) => {
      setVersionId(id)
    },
    [setVersionId],
  )

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

  const handleVersionPickerPress = useCallback(
    async (data: BibleVersionPickerPressData) => {
      if (Platform.OS === 'web' || !showToolbar) return
      if (consumerOnVersionPickerPress) {
        await consumerOnVersionPickerPress(data)
      } else {
        setIsVersionPickerOpen(true)
      }
    },
    [consumerOnVersionPickerPress, showToolbar],
  )

  const onOpenWindow = useCallback(
    async (event: WebViewOpenWindowEvent) => {
      try {
        await WebBrowser.openBrowserAsync(event.nativeEvent.targetUrl, {
          dismissButtonStyle: 'close',
        })
        dom?.onOpenWindow?.(event)
      } catch (error) {
        console.error(error)
      }
    },
    [dom],
  )

  const showFootnoteSheet = Platform.OS !== 'web' && !consumerOnFootnotePress
  const showPickerSheet = Platform.OS !== 'web' && showToolbar && !consumerOnChapterPickerPress
  const showVersionPickerSheet =
    Platform.OS !== 'web' && showToolbar && !consumerOnVersionPickerPress

  const authProps = context.authRedirectUrl
    ? ({ includeAuth: true, authRedirectUrl: context.authRedirectUrl } as const)
    : ({} as const)

  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const isLandscape = width > height
  // iOS clears the status bar via contentInsetAdjustmentBehavior, but Android
  // (edge-to-edge) draws under it and has no such WebView prop, so pad the
  // reader down by the top inset there and shrink the WebView to match.
  const topInset = Platform.OS === 'android' && !disableTopInset ? insets.top : 0
  const readerDom = useMemo(
    () => ({
      ...dom,
      onOpenWindow,
      // We size the WebView to the full window, so in landscape suppress the
      // iOS content-inset adjustment that would otherwise add a top inset.
      // Portrait keeps the default so the toolbar still clears the status bar.
      ...(isLandscape
        ? {
            contentInsetAdjustmentBehavior: 'never' as const,
            automaticallyAdjustContentInsets: false,
          }
        : {}),
      style: StyleSheet.flatten([dom?.style, { width, height: height - topInset }]),
    }),
    [dom, onOpenWindow, width, height, topInset, isLandscape],
  )

  return (
    <>
      <View style={[styles.readerHost, { paddingTop: topInset }]}>
        <BibleReaderDOM
          {...authProps}
          appKey={context.appKey}
          apiHost={context.apiHost}
          installationId={context.installationId}
          accessToken={accessToken}
          onSignInPress={signIn}
          onSignOutPress={signOut}
          userInfo={userInfo}
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
          onVersionPickerPress={handleVersionPickerPress}
          onFootnotePress={onFootnotePress}
          backgroundColor={backgroundColor}
          foregroundColor={foregroundColor}
          dom={readerDom}
        />
      </View>
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
          showAndroidLoader
          theme={resolvedTheme}
        >
          <FootnoteContent
            dom={{ matchContents: true }}
            data={footnoteData ?? EMPTY_FOOTNOTE}
            theme={resolvedTheme}
            fontSize={fontSize}
            appKey={context.appKey}
            apiHost={context.apiHost}
            installationId={context.installationId}
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
      {showVersionPickerSheet && (
        <BibleVersionPickerSheet
          isOpen={isVersionPickerOpen}
          onClose={() => setIsVersionPickerOpen(false)}
          versionId={versionId}
          theme={resolvedTheme}
          onSelect={async (newVersionId) => {
            setVersionId(newVersionId)
          }}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  readerHost: {
    flex: 1,
  },
})
