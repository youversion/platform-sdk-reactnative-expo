import { useControllableState } from '@radix-ui/react-use-controllable-state'
import {
  deriveServerColors,
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
import type { Ref } from 'react'
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
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
import { buildVerseActionSwatches, type VerseActionSwatch } from '../lib/verse-action-swatches'
import { BibleChapterPickerSheet } from './bible-chapter-picker-sheet'
import { BibleReaderSettingsSheet } from './bible-reader-settings-sheet'
import { BibleVerseActionSheet } from './bible-verse-action-sheet'
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

/**
 * The imperative surface of `BibleReader`, reached through a `ref`.
 *
 * ```tsx
 * const reader = useRef<BibleReaderHandle>(null)
 * useFocusEffect(useCallback(() => { void reader.current?.refreshHighlights() }, []))
 * <BibleReader ref={reader} />
 * ```
 */
export type BibleReaderHandle = {
  /**
   * Re-fetch the highlights for the chapter on screen, picking up anything
   * created on another device or in the YouVersion app.
   *
   * The SDK already revalidates on its own when the app returns from the
   * background. **Navigation focus is the half it cannot see**: detecting it
   * would mean taking `@react-navigation/native` as a peer dependency and
   * forcing a navigation library on every consumer, so the host — which owns
   * navigation anyway — calls this instead. Wire it to your router's focus
   * event (`useFocusEffect` on Expo Router / React Navigation).
   *
   * Safe to call at any time: it de-dupes against a fetch already in flight,
   * no-ops when signed out, and never clears what is already painted.
   */
  refreshHighlights: () => Promise<void>
}

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
  // Verse actions are a native sheet the reader owns (ADR 0015). It suppresses
  // the Web SDK's in-WebView popover and drives the selection clear itself, so
  // neither knob is a consumer surface.
  | 'verseActions'
  | 'clearSelectionSignal'
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
  /**
   * Handle Copy yourself instead of the SDK's `expo-clipboard` fallback. Fired
   * by the native verse action sheet's Copy button with the payload
   * `onVerseSelect` already carried, so it costs no extra bridge round-trip.
   *
   * Not wired on web, where the Web SDK's own popover and `navigator.clipboard`
   * remain the right behaviour.
   */
  onCopy?: (data: BibleReaderShareData) => Promise<void>
  /** Share's counterpart to {@link onCopy}; falls back to RN's `Share.share`. */
  onShare?: (data: BibleReaderShareData) => Promise<void>
  /**
   * Imperative handle — see {@link BibleReaderHandle}. React 19 passes `ref`
   * as an ordinary prop, so there is no `forwardRef` here.
   */
  ref?: Ref<BibleReaderHandle>
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
  ref,
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
    refresh: refreshHighlights,
    prompt,
    onPromptConfirm,
    onPromptDismiss,
  } = useReaderHighlights({
    versionId,
    book,
    chapter,
    onHighlightError,
  })

  // Navigation focus is invisible to the SDK without taking a navigation
  // library as a peer dependency, so the host calls this on focus instead. The
  // app-foreground half is handled inside core's `useHighlights`.
  useImperativeHandle(ref, () => ({ refreshHighlights }), [refreshHighlights])

  // ── Verse actions ────────────────────────────────────────────────────────
  // The reader owns the committed selection so it can raise a native sheet over
  // it (ADR 0015). The Web SDK still owns selection *state*; this is a mirror of
  // what it committed, and the only thing travelling back is the clear signal.
  const [selection, setSelection] = useState<BibleReaderVerseSelection | null>(null)
  // One-way DOM command. Bumped on every exit from the sheet — a write, a
  // copy/share, or a dismiss — because with `verseActions="none"` there is
  // nothing left inside the WebView that can clear the selection.
  const [clearSelectionSignal, setClearSelectionSignal] = useState(0)

  const handleVerseSelect = useCallback(
    async (next: BibleReaderVerseSelection) => {
      setSelection(next.verses.length > 0 ? next : null)
      await onVerseSelect?.(next)
    },
    [onVerseSelect],
  )

  const closeVerseActions = useCallback(() => {
    setSelection(null)
    setClearSelectionSignal((signal) => signal + 1)
  }, [])

  // Optimistic paint included: `highlights` is what the user sees, and the tray
  // has to agree with the page under it.
  const swatches = useMemo(() => {
    if (selection === null) return []
    return buildVerseActionSwatches({
      verses: selection.verses,
      colors: deriveServerColors(highlights, {
        versionId: selection.versionId,
        book: selection.book,
        chapter: selection.chapter,
      }),
    })
  }, [selection, highlights])

  const handleSwatchPress = useCallback(
    (swatch: VerseActionSwatch) => {
      if (selection === null) return
      const intent = {
        versionId: selection.versionId,
        book: selection.book,
        chapter: selection.chapter,
        verses: selection.verses,
        passageIds: selection.passageIds,
        color: swatch.color,
      }
      // Fire and forget: everything downstream of the tap — the gate, the
      // prompts, the optimistic paint, the durable queue — already exists and
      // reports through its own channels. Awaiting here would only hold the
      // sheet open over a network round-trip.
      void (swatch.state === 'remove' ? onHighlightRemove(intent) : onHighlightApply(intent))
      closeVerseActions()
    },
    [selection, onHighlightApply, onHighlightRemove, closeVerseActions],
  )

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
      translate('dataExchangeHighlightsQuestion'),
      translate('dataExchangeHighlightsExplanation'),
      [
        { text: translate('cancel'), style: 'cancel', onPress: dismiss },
        { text: translate('dataExchangeContinue'), onPress: confirm },
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
  // `VerseOfTheDay` already ships for share. Both replace the Web SDK's browser
  // defaults, which don't work inside an Expo DOM WebView. Since Phase 9 they
  // are driven by the native verse action sheet rather than by a Native Action
  // fired from the WebView, but the contract is unchanged.
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
  // and Share buttons need no round-trip back into the WebView to build it.
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
          onVerseSelect={handleVerseSelect}
          // Web keeps the Web SDK's own popover: `NativeSheet` renders nothing
          // there, so suppressing it would leave no verse-action UI at all.
          verseActions={Platform.OS !== 'web' ? 'none' : 'popover'}
          clearSelectionSignal={clearSelectionSignal}
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
          // Yields to the sign-in sheet rather than racing it. `NativeSheet`
          // allows one active sheet at a time and calls `onClose` on whichever
          // it displaces, so leaving both "open" would clear the selection as a
          // side effect of losing — and the pending highlight replay would then
          // land with nothing selected.
          isOpen={selection !== null && prompt === 'none'}
          reference={selection?.reference ?? ''}
          swatches={swatches}
          onSwatchPress={handleSwatchPress}
          onCopyPress={handleCopyPress}
          onSharePress={handleSharePress}
          onClose={closeVerseActions}
          theme={resolvedTheme}
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
