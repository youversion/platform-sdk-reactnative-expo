import { useControllableState } from '@radix-ui/react-use-controllable-state'
import { useYouVersion, useYVAuthOptional } from '@youversion/platform-react-native-expo-core'
import type {
  BibleChapterPickerPressData,
  BibleReaderShareData,
  BibleVersionPickerPressData,
  FootnoteData,
} from '@youversion/platform-react-ui'
import * as Clipboard from 'expo-clipboard'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Platform, Share, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'
import type { BibleReaderProps as DomBibleReaderProps } from '../dom/bible-reader'
import BibleReaderDOM from '../dom/bible-reader'
import FootnoteContent from '../dom/footnote-content'
import { useTheme } from '../hooks/use-theme'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { DEFAULT_BIBLE_VERSION_ID } from '../lib/constants'
import { withSheetDomDefaults } from '../lib/embed-dom-props'
import { encodeFontFamilyForDom } from '../lib/reader-fonts'
import { computeReaderBottomScrollPadding } from '../lib/reader-bottom-scroll-padding'
import { useReaderLocationStore } from '../stores/reader-location-store'
import { useReaderSettingsStore } from '../stores/reader-settings-store'
import { BibleChapterPickerSheet } from './bible-chapter-picker-sheet'
import { BibleReaderSettingsSheet } from './bible-reader-settings-sheet'
import { BibleVersionPickerSheet } from './bible-version-picker-sheet'
import { NativeSheet } from './native-sheet'
import { SignInWithYouVersionSheet } from './sign-in-with-youversion-sheet'
import type { HighlightWriteError } from './use-reader-highlights'
import { useReaderHighlights } from './use-reader-highlights'
import { useSignOutGuard } from './use-sign-out-guard'

const EMPTY_FOOTNOTE: FootnoteData = {
  verseNum: '',
  notes: [],
  verseHtml: '',
}

const DEFAULT_BOOK = 'JHN'
const DEFAULT_CHAPTER = '1'

export type BibleReaderProps = Omit<
  DomBibleReaderProps,
  | 'appKey'
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
  // Highlights are SDK-owned: the reader fetches, caches, paints, and writes
  // them itself via `useReaderHighlights`. Controlled mode is an internal
  // mechanism for talking to the Web SDK, not a surface consumers pass through.
  | 'highlights'
  | 'onHighlightApply'
  | 'onHighlightRemove'
  // The reader owns its own bottom scroll padding (tab bar + home indicator on iOS),
  // so consumers don't pass it — it lives inside the WebView.
  | 'bottomScrollPadding'
> & {
  theme?: 'light' | 'dark' | 'system'
  defaultBook?: string
  defaultChapter?: string
  defaultVersionId?: number
  onFootnotePress?: (data: FootnoteData) => Promise<void>
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  /**
   * A highlight has not reached the server yet. It is **queued and retrying**,
   * persisted across an app kill, and still painted — so render it as a pending
   * or offline hint rather than a failure. The SDK doesn't own toast styling.
   * Payload errors are logged, not reported here; the user can't act on them.
   */
  onHighlightError?: (error: HighlightWriteError) => void
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
  onCopy: consumerOnCopy,
  onShare: consumerOnShare,
  onHighlightError,
  backgroundColor,
  foregroundColor,
  dom,
}: BibleReaderProps) {
  const context = useYouVersion()
  const auth = useYVAuthOptional()
  const accessToken = auth?.accessToken ?? null
  const userInfo = auth?.userInfo ?? null
  const signIn = auth?.signIn
  // The in-WebView toolbar's sign-out is the reader's second entry point into
  // the same guard the auth button uses — the warning has to be true on both.
  const signOut = useSignOutGuard(auth)
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

  // The wrapper already owns the full highlight scope, so the orchestrator reads
  // it straight off the reader's location state.
  const {
    highlights,
    onHighlightApply,
    onHighlightRemove,
    prompt,
    onPromptConfirm,
    onPromptDismiss,
  } = useReaderHighlights({
    versionId,
    book,
    chapter,
    onHighlightError,
  })

  // The just-in-time permission prompt is a native `Alert`, not a sheet — Swift
  // makes the sign-in prompt the only full sheet in this flow. Fired from an
  // effect keyed on the prompt phase alone: the handlers and `t` change identity
  // freely, and depending on them would re-present the alert on every render.
  const { t } = useSdkTranslation()
  const promptActionsRef = useRef({ onPromptConfirm, onPromptDismiss, t })
  useEffect(() => {
    promptActionsRef.current = { onPromptConfirm, onPromptDismiss, t }
  })
  useEffect(() => {
    if (prompt !== 'permission') return
    const {
      onPromptConfirm: confirm,
      onPromptDismiss: dismiss,
      t: translate,
    } = promptActionsRef.current
    Alert.alert(
      translate('dataExchange.highlights.question'),
      translate('dataExchange.highlights.explanation'),
      [
        { text: translate('generic.cancel'), style: 'cancel', onPress: dismiss },
        { text: translate('dataExchange.continue'), onPress: confirm },
      ],
      // Android's hardware back / outside tap dismisses without a button press.
      { onDismiss: dismiss },
    )
  }, [prompt])

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

  // Consumer override wins, else the SDK's native fallback — the same shape
  // `VerseOfTheDay` already ships for share. Both suppress the Web SDK's
  // browser defaults, which don't work inside an Expo DOM WebView.
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
          onSignInPress={signIn}
          onSignOutPress={signOut}
          userInfo={userInfo}
          theme={resolvedTheme}
          book={book}
          chapter={chapter}
          versionId={versionId}
          highlights={highlights}
          onHighlightApply={onHighlightApply}
          onHighlightRemove={onHighlightRemove}
          onVerseSelect={onVerseSelect}
          onCopy={Platform.OS !== 'web' ? handleCopy : undefined}
          onShare={Platform.OS !== 'web' ? handleShare : undefined}
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
        <SignInWithYouVersionSheet
          isOpen={prompt === 'sign-in'}
          onConfirm={onPromptConfirm}
          onDismiss={onPromptDismiss}
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
