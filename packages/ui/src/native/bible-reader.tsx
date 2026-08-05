import { useControllableState } from '@radix-ui/react-use-controllable-state'
import {
  useHighlights,
  useYouVersion,
  useYVAuthOptional,
} from '@youversion/platform-react-native-expo-core'
import type {
  BibleChapterPickerPressData,
  BibleReaderShareData,
  BibleReaderVerseSelection,
  BibleVersionPickerPressData,
  FootnoteData,
} from '@youversion/platform-react-ui'
import * as Clipboard from 'expo-clipboard'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useMemo, useState } from 'react'
import { Platform, Share, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'
import type { BibleReaderProps as DomBibleReaderProps } from '../dom/bible-reader'
import BibleReaderDOM from '../dom/bible-reader'
import FootnoteContent from '../dom/footnote-content'
import { useTheme } from '../hooks/use-theme'
import { DEFAULT_BIBLE_VERSION_ID } from '../lib/constants'
import { withSheetDomDefaults } from '../lib/embed-dom-props'
import { encodeFontFamilyForDom } from '../lib/reader-fonts'
import { computeReaderBottomScrollPadding } from '../lib/reader-bottom-scroll-padding'
import { useReaderLocationStore } from '../stores/reader-location-store'
import { useReaderSettingsStore } from '../stores/reader-settings-store'
import { BibleChapterPickerSheet } from './bible-chapter-picker-sheet'
import { BibleReaderSettingsSheet } from './bible-reader-settings-sheet'
import { BibleVerseActionSheet } from './bible-verse-action-sheet'
import { BibleVersionPickerSheet } from './bible-version-picker-sheet'
import { NativeSheet } from './native-sheet'

const EMPTY_FOOTNOTE: FootnoteData = {
  verseNum: '',
  notes: [],
  verseHtml: '',
}

const DEFAULT_BOOK = 'JHN'
const DEFAULT_CHAPTER = '1'

/**
 * Re-exported so an `onVerseSelect` handler can be typed without depending on
 * `@youversion/platform-react-ui` directly.
 */
export type { BibleReaderShareData, BibleReaderVerseSelection } from '@youversion/platform-react-ui'

export type BibleReaderProps = Omit<
  DomBibleReaderProps,
  | 'appKey'
  | 'highlights'
  | 'fontSize'
  | 'fontFamily'
  | 'lineSpacing'
  | 'onFontSizeChange'
  | 'onFontFamilyChange'
  | 'onLineSpacingChange'
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
  | 'onExternalLinkPress'
  | 'userInfo'
  // The reader owns its bottom scroll padding (tab bar + home indicator on iOS).
  | 'bottomScrollPadding'
  // `onVerseSelect` and `clearSelectionSignal` are deliberately kept — they are
  // the consumer's only handle on a selection. The reader now taps both on its
  // way past: it mirrors the payload to raise the native verse action sheet, and
  // it adds its own clears to the consumer's counter.
> & {
  theme?: 'light' | 'dark' | 'system'
  defaultBook?: string
  defaultChapter?: string
  defaultVersionId?: number
  onFootnotePress?: (data: FootnoteData) => Promise<void>
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  /**
   * Handle Copy yourself instead of the SDK's `expo-clipboard` fallback. Fired
   * by the native verse action sheet's Copy button with the payload
   * `onVerseSelect` already carried, so it costs no extra bridge round-trip.
   *
   * Native-only: it never crosses into the WebView, and on web the Web SDK's own
   * popover and `navigator.clipboard` remain the right behavior.
   */
  onCopy?: (data: BibleReaderShareData) => void | Promise<void>
  /** Share's counterpart to {@link BibleReaderProps.onCopy}; falls back to RN's `Share.share`. */
  onShare?: (data: BibleReaderShareData) => void | Promise<void>
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
  defaultVersionId = DEFAULT_BIBLE_VERSION_ID,
  onVersionChange,
  showToolbar = true,
  onChapterPickerPress: consumerOnChapterPickerPress,
  onVersionPickerPress: consumerOnVersionPickerPress,
  onFootnotePress: consumerOnFootnotePress,
  onVerseSelect,
  // Defaulted to `0` so a number always crosses the bridge from first mount.
  // The Web SDK treats the value it sees at mount as a baseline and clears the
  // selection on every change after that. Leaving this `undefined` means a
  // consumer who starts passing the signal later trips `undefined !== 0` and
  // fires a spurious clear on their first render with the prop. The prop stays
  // optional in the public type — this is a default, not a requirement.
  clearSelectionSignal = 0,
  onCopy: consumerOnCopy,
  onShare: consumerOnShare,
  backgroundColor,
  foregroundColor,
  dom,
}: BibleReaderProps) {
  const context = useYouVersion()
  const auth = useYVAuthOptional()
  const accessToken = auth?.accessToken ?? null
  const userInfo = auth?.userInfo ?? null
  const signIn = auth?.signIn
  const signOut = auth?.signOut
  const resolvedTheme = useTheme(theme)

  const { setFontFamily, setFontSize, setLineSpacing, fontSize, fontFamily, lineSpacing } =
    useReaderSettingsStore()

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
    onChange: (newBook) => {
      if (controlledBook === undefined) setLocation({ book: newBook })
      onBookChange?.(newBook)
    },
  })

  const [chapter, setChapter] = useControllableState({
    prop: controlledChapter,
    defaultProp:
      controlledChapter !== undefined ? defaultChapter : (storedChapter ?? defaultChapter),
    onChange: (newChapter) => {
      if (controlledChapter === undefined) setLocation({ chapter: newChapter })
      onChapterChange?.(newChapter)
    },
  })

  const [versionId, setVersionId] = useControllableState({
    prop: controlledVersionId,
    defaultProp:
      controlledVersionId !== undefined ? defaultVersionId : (storedVersionId ?? defaultVersionId),
    onChange: (newVersionId) => {
      if (controlledVersionId === undefined) setLocation({ versionId: newVersionId })
      onVersionChange?.(newVersionId)
    },
  })

  const { highlights } = useHighlights({ versionId, book, chapter })

  const [footnoteData, setFootnoteData] = useState<FootnoteData | null>(null)
  // footnoteData can remain non-null across repeated taps, so track each tap as an open event.
  const [footnoteOpenKey, setFootnoteOpenKey] = useState(0)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isVersionPickerOpen, setIsVersionPickerOpen] = useState(false)
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false)

  // ── Verse actions ────────────────────────────────────────────────────────
  // The reader owns the committed selection so it can raise a native sheet over
  // it. The Web SDK still owns selection *state*; this is a mirror of what it
  // committed, and the only thing travelling back is the clear signal.
  const [selection, setSelection] = useState<BibleReaderVerseSelection | null>(null)
  // One-way DOM command, bumped on every exit from the sheet. With
  // `verseActions="none"` there is nothing left inside the WebView that can
  // clear the selection, so the reader has to say so.
  //
  // It is *added* to the consumer's `clearSelectionSignal` rather than replacing
  // it: the Web SDK only reacts to changes in the number it receives, so a sum
  // lets both the consumer's public prop and the reader's own exits clear. Both
  // start at 0, so mounting still forwards 0 and clears nothing.
  const [internalClearCount, setInternalClearCount] = useState(0)

  const handleVerseSelect = useCallback(
    async (next: BibleReaderVerseSelection) => {
      setSelection(next.verses.length > 0 ? next : null)
      await onVerseSelect?.(next)
    },
    [onVerseSelect],
  )

  const closeVerseActions = useCallback(() => {
    setSelection(null)
    setInternalClearCount((count) => count + 1)
  }, [])

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

  // Consumer override wins, else the SDK's native fallback — the same shape
  // `VerseOfTheDay` already ships for share. Both replace the Web SDK's browser
  // defaults, which don't work inside an Expo DOM WebView.
  const handleCopy = useCallback(
    async (data: BibleReaderShareData) => {
      try {
        if (consumerOnCopy) {
          await consumerOnCopy(data)
          return
        }
        await Clipboard.setStringAsync(data.text)
      } catch (error) {
        // Swallowed: a failed copy reads to the user like a dismissed sheet,
        // and there is nothing actionable to say about it.
        console.error('BibleReader copy failed:', error)
      }
    },
    [consumerOnCopy],
  )

  const handleShare = useCallback(
    async (data: BibleReaderShareData) => {
      try {
        if (consumerOnShare) {
          await consumerOnShare(data)
          return
        }
        await Share.share({ message: data.text })
      } catch (error) {
        console.error('BibleReader share failed:', error)
      }
    },
    [consumerOnShare],
  )

  // `shareData` rides in on `onVerseSelect` (Web SDK 2.5.0), so the sheet's Copy
  // and Share buttons need no round-trip back into the WebView to build it. The
  // sheet closes first, so the read has to happen before `closeVerseActions`
  // drops the mirror.
  const handleCopyPress = useCallback(() => {
    const data = selection?.shareData
    closeVerseActions()
    if (data) void handleCopy(data)
  }, [selection, handleCopy, closeVerseActions])

  const handleSharePress = useCallback(() => {
    const data = selection?.shareData
    closeVerseActions()
    if (data) void handleShare(data)
  }, [selection, handleShare, closeVerseActions])

  const onExternalLinkPress = useCallback(async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        dismissButtonStyle: 'close',
      })
    } catch (error) {
      console.error(error)
    }
  }, [])

  const showFootnoteSheet = Platform.OS !== 'web' && !consumerOnFootnotePress
  const showPickerSheet = Platform.OS !== 'web' && showToolbar && !consumerOnChapterPickerPress
  const showVersionPickerSheet =
    Platform.OS !== 'web' && showToolbar && !consumerOnVersionPickerPress

  const authProps = context.authRedirectUrl
    ? ({ includeAuth: true, authRedirectUrl: context.authRedirectUrl } as const)
    : ({} as const)

  // Pad scroll content inside the WebView so the closing copyright clears the
  // native tab bar overlay and home indicator. NativeTabs adjusts ScrollViews
  // automatically, but the reader opts out — clearance is owned here.
  const { bottom: bottomSafeArea } = useSafeAreaInsets()
  const bottomScrollPadding = computeReaderBottomScrollPadding(bottomSafeArea, Platform.OS)

  const readerDom = useMemo(
    () => ({
      scrollEnabled: false,
      contentInsetAdjustmentBehavior: 'never' as const,
      automaticallyAdjustContentInsets: false,
      ...dom,
      style: StyleSheet.flatten([dom?.style, { flex: 1 }]),
    }),
    [dom],
  )

  return (
    <>
      <View style={{ flex: 1 }}>
        <BibleReaderDOM
          {...authProps}
          appKey={context.appKey}
          apiHost={context.apiHost}
          installationId={context.installationId}
          accessToken={accessToken}
          highlights={highlights}
          onVerseSelect={handleVerseSelect}
          clearSelectionSignal={clearSelectionSignal + internalClearCount}
          onSignInPress={signIn}
          onSignOutPress={signOut}
          userInfo={userInfo}
          theme={resolvedTheme}
          book={book}
          chapter={chapter}
          versionId={versionId}
          fontSize={fontSize}
          fontFamily={encodeFontFamilyForDom(fontFamily)}
          lineSpacing={lineSpacing}
          onFontSizeChange={setFontSize}
          onFontFamilyChange={setFontFamily}
          onLineSpacingChange={setLineSpacing}
          onOpenBibleThemeSettings={
            Platform.OS !== 'web' ? handleOpenBibleThemeSettings : undefined
          }
          onBookChange={handleBookChange}
          onChapterChange={handleChapterChange}
          onVersionChange={handleVersionChange}
          showToolbar={showToolbar}
          onChapterPickerPress={handleChapterPickerPress}
          onVersionPickerPress={handleVersionPickerPress}
          onFootnotePress={onFootnotePress}
          onExternalLinkPress={Platform.OS !== 'web' ? onExternalLinkPress : undefined}
          backgroundColor={backgroundColor}
          foregroundColor={foregroundColor}
          bottomScrollPadding={bottomScrollPadding}
          dom={readerDom}
        />
      </View>
      {Platform.OS !== 'web' && (
        <BibleReaderSettingsSheet
          isSettingsSheetOpen={isSettingsSheetOpen}
          onClose={() => setIsSettingsSheetOpen(false)}
        />
      )}
      {Platform.OS !== 'web' && (
        <BibleVerseActionSheet
          isOpen={selection !== null}
          reference={selection?.reference ?? ''}
          onCopyPress={handleCopyPress}
          onSharePress={handleSharePress}
          onClose={closeVerseActions}
          theme={resolvedTheme}
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
            dom={withSheetDomDefaults()}
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
