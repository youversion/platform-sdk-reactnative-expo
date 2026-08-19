import { useControllableState } from '@radix-ui/react-use-controllable-state'
import {
  deriveServerColors,
  useHighlightPermissionFlow,
  useYouVersion,
  useYVAuthOptional,
  type HighlightColor,
  type HighlightScope,
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
import { Platform, Share, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'
import type { BibleReaderProps as DomBibleReaderProps } from '../dom/bible-reader'
import { getImpl } from './component-impls'
import { useTheme } from '../hooks/use-theme'
import { DEFAULT_BIBLE_VERSION_ID } from '../lib/constants'
import { withSheetDomDefaults } from '../lib/embed-dom-props'
import { encodeFontFamilyForDom } from '../lib/reader-fonts'
import { computeReaderBottomScrollPadding } from '../lib/reader-bottom-scroll-padding'
import {
  reportHighlightWriteError,
  type HighlightWriteError,
} from '../lib/report-highlight-write-error'
import { resolveVerseActions } from '../lib/resolve-verse-actions'
import { buildVerseActionSwatches, type VerseActionSwatch } from '../lib/verse-action-swatches'
import { useReaderLocationStore } from '../stores/reader-location-store'
import { useReaderSettingsStore } from '../stores/reader-settings-store'
import { BibleChapterPickerSheet } from './bible-chapter-picker-sheet'
import { BibleReaderSettingsSheet } from './bible-reader-settings-sheet'
import { BibleVerseActionSheet } from './bible-verse-action-sheet'
import { BibleVersionPickerSheet } from './bible-version-picker-sheet'
import { HighlightConsentSheet } from './highlight-consent-sheet'
import { NativeSheet } from './native-sheet'
import { SignInWithYouVersionSheet } from './sign-in-with-youversion-sheet'
import { useSignOutGuard } from './use-sign-out-guard'

// Placeholder so NativeSheet can mount FootnoteContent on page load and pre-warm the WebView.
const EMPTY_FOOTNOTE: FootnoteData = {
  verseNum: '',
  notes: [],
  verseHtml: '',
}

const DEFAULT_BOOK = 'JHN'
const DEFAULT_CHAPTER = '1'

// Computed once: `Platform.OS` cannot change at runtime.
const VERSE_ACTIONS = resolveVerseActions(Platform.OS)

/**
 * A swatch press the reader holds while it asks the user something. The press
 * outlives the selection. The action sheet closes before the prompt opens, so
 * `verseSelection` is already `null` when the answer comes back.
 *
 * `scope` is load-bearing, because verse numbers alone are not a passage.
 * Replayed through a location the reader has since left, they would paint text
 * the user never selected. Core's Pending Highlight carries the same contract
 * (ADR 0016).
 */
type PendingSwatchIntent = { color: HighlightColor; verses: number[]; scope: HighlightScope }

/**
 * Which prompt the reader is showing on its own account. For `'sign-in'` it also
 * carries the passage the prompt was raised for. The scope is held here instead
 * of read off {@link PendingSwatchIntent}, because the discard below runs during
 * render, and `react-hooks/refs` forbids touching a ref there.
 */
type PromptState = { kind: 'none' } | { kind: 'sign-in'; scope: HighlightScope }

type AuthGate = 'unconfigured' | 'settling' | 'signed-out' | 'ready'

function resolveAuthGate(auth: ReturnType<typeof useYVAuthOptional>): AuthGate {
  if (auth === null) return 'unconfigured'
  // A token in hand is ready even if `isLoading` is still true. `isAuthenticated`
  // is `accessToken !== null`, not the seeded `userInfo`. A stored session is
  // therefore *not* authenticated during the loading window.
  if (auth.isAuthenticated) return 'ready'
  if (auth.isLoading) return 'settling'
  return 'signed-out'
}

/** Stable identity, so the render-time discard cannot re-trigger itself. */
const NO_PROMPT: PromptState = { kind: 'none' }

function sameScope(a: HighlightScope, b: HighlightScope): boolean {
  return a.versionId === b.versionId && a.book === b.book && a.chapter === b.chapter
}

/**
 * Re-exported so an `onVerseSelect` handler can be typed without depending on
 * `@youversion/platform-react-ui` directly.
 */
export type { BibleReaderShareData, BibleReaderVerseSelection } from '@youversion/platform-react-ui'
export type { HighlightWriteError } from '../lib/report-highlight-write-error'

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
   * Safe to call at any time: it de-dupes against a fetch already in flight,
   * no-ops when signed out, and never clears what is already painted.
   */
  refreshHighlights: () => Promise<void>
}

export type BibleReaderProps = Omit<
  DomBibleReaderProps,
  | 'appKey'
  | 'highlights'
  // Picked per platform by `VERSE_ACTIONS` above, not a consumer choice.
  | 'verseActions'
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
  | 'onSignInPress'
  | 'onSignOutPress'
  | 'onExternalLinkPress'
  | 'userInfo'
  // The reader owns its bottom scroll padding (tab bar + home indicator on iOS).
  | 'bottomScrollPadding'
  // `onVerseSelect` and `clearSelectionSignal` are deliberately kept. They are
  // the consumer's only handle on a selection. The reader taps both on the way
  // past: it mirrors the payload to raise the native verse action sheet, and it
  // adds its own clears to the consumer's counter.
> & {
  theme?: 'light' | 'dark' | 'system'
  defaultBook?: string
  defaultChapter?: string
  defaultVersionId?: number
  onFootnotePress?: (data: FootnoteData) => Promise<void>
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  /**
   * Handle Copy yourself instead of the SDK's `expo-clipboard` fallback. The
   * native verse action sheet's Copy button fires it, with the same payload
   * `onVerseSelect` already carried.
   *
   * Native only. On web the in-WebView popover handles Copy itself.
   */
  onCopy?: (data: BibleReaderShareData) => void | Promise<void>
  /** Share's counterpart to {@link BibleReaderProps.onCopy}. Falls back to RN's `Share.share`. */
  onShare?: (data: BibleReaderShareData) => void | Promise<void>
  /**
   * A highlight has not reached the server yet — queued and retrying, or a
   * transient failure the write queue will keep retrying. The paint stays on
   * screen; render an offline or pending hint rather than an error toast.
   */
  onHighlightError?: (error: HighlightWriteError) => void
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
  // Defaulted to `0` so a number always crosses the bridge from first mount.
  // The Web SDK treats the value it sees at mount as a baseline and clears the
  // selection on every change after that. Leaving this `undefined` means a
  // consumer who starts passing the signal later trips `undefined !== 0` and
  // fires a spurious clear on their first render with the prop. The prop stays
  // optional in the public type — this is a default, not a requirement.
  clearSelectionSignal = 0,
  onCopy: consumerOnCopy,
  onShare: consumerOnShare,
  onHighlightError,
  backgroundColor,
  foregroundColor,
  dom,
  ref,
}: BibleReaderProps) {
  const context = useYouVersion()
  // Read for `userInfo`, `signIn`, and the sign-out guard. The access token is
  // deliberately not read here: it never crosses into the WebView.
  const auth = useYVAuthOptional()
  const userInfo = auth?.userInfo ?? null
  const signIn = auth?.signIn
  const guardedSignOut = useSignOutGuard(auth)
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

  const highlightPermissionFlow = useHighlightPermissionFlow({ versionId, book, chapter })
  const {
    highlights,
    scope: highlightScope,
    remove: removeHighlight,
    refresh: refreshHighlights,
  } = highlightPermissionFlow.highlights

  useImperativeHandle(ref, () => ({ refreshHighlights }), [refreshHighlights])

  const [footnoteData, setFootnoteData] = useState<FootnoteData | null>(null)
  // footnoteData can remain non-null across repeated taps, so track each tap as an open event.
  const [footnoteOpenKey, setFootnoteOpenKey] = useState(0)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isVersionPickerOpen, setIsVersionPickerOpen] = useState(false)
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false)

  // ── Verse actions ────────────────────────────────────────────────────────
  // The reader owns the committed selection so it can raise a native sheet over
  // it. The Web SDK still owns selection *state*. This is a mirror of what the
  // Web SDK committed, and the only thing traveling back is the clear signal.
  const [verseSelection, setVerseSelection] = useState<BibleReaderVerseSelection | null>(null)
  // One-way DOM command, bumped on every exit from the sheet. With the popover
  // suppressed, nothing inside the WebView clears the selection any more. The
  // count is *added* to the consumer's `clearSelectionSignal` instead of
  // replacing it, so both the public prop and the reader's own exits can clear.
  const [internalClearCount, setInternalClearCount] = useState(0)

  // The consent prompt is not in here. The flow owns that one, gated on
  // `highlightPermissionFlow.isConfirming`.
  const [prompt, setPrompt] = useState<PromptState>(NO_PROMPT)
  // A ref, not state: nothing renders from it, and the sign-in sheet's confirm
  // needs the value on the same tick it fires.
  const pendingIntentRef = useRef<PendingSwatchIntent | null>(null)

  // Discard a pending sign-in prompt when the reader leaves the passage the
  // prompt belonged to. A controlled consumer can change book, chapter, or
  // versionId while the prompt is up. This is the same "adjust state when props
  // change" pattern as the Permission Flow's RESET. An effect would leave one
  // frame where the sheet for the old chapter is still open over the new one.
  // `renderedPrompt` is what this frame paints, because `setPrompt` alone would
  // still leave the sheet open for one render.
  //
  // The stale intent on the ref is left alone. Closing the sheet means nothing
  // can fire `onConfirm`, the next swatch press overwrites the intent, and the
  // confirm handler re-checks the scope anyway.
  const currentScope: HighlightScope = { versionId, book, chapter }
  let renderedPrompt = prompt
  if (prompt.kind === 'sign-in' && !sameScope(prompt.scope, currentScope)) {
    renderedPrompt = NO_PROMPT
    setPrompt(NO_PROMPT)
  }

  const handleVerseSelect = useCallback(
    async (next: BibleReaderVerseSelection) => {
      // A new non-empty selection is the user picking other verses. Drop a
      // held tap so settle cannot prompt for the old ones. An empty payload is
      // our own `closeVerseActions` after the swatch press — keep the hold.
      if (next.verses.length > 0 && prompt.kind === 'none' && pendingIntentRef.current !== null) {
        pendingIntentRef.current = null
      }
      setVerseSelection(next.verses.length > 0 ? next : null)
      await onVerseSelect?.(next)
    },
    [onVerseSelect, prompt.kind],
  )

  const closeVerseActions = useCallback(() => {
    setVerseSelection(null)
    setInternalClearCount((count) => count + 1)
  }, [])

  // Which circles the tray shows, projected from the same painted array the
  // WebView renders. A swatch can never disagree with the passage behind it.
  const swatches = useMemo(
    () =>
      buildVerseActionSwatches({
        verses: verseSelection?.verses ?? [],
        colors: deriveServerColors(highlights, highlightScope),
      }),
    [verseSelection, highlights, highlightScope],
  )

  const applyHighlight = highlightPermissionFlow.apply
  const authGate = resolveAuthGate(auth)

  const replayPendingIntent = useCallback(() => {
    const pending = pendingIntentRef.current
    pendingIntentRef.current = null
    if (!pending) return
    // Backstop for the during-render discard above. A confirm that races a
    // controlled location change must not hand verse numbers to the current
    // location-scoped flow.
    if (!sameScope(pending.scope, { versionId, book, chapter })) return
    void applyHighlight(pending.color, pending.verses).then((outcome) =>
      reportHighlightWriteError(outcome, onHighlightError),
    )
  }, [applyHighlight, onHighlightError, versionId, book, chapter])

  const handleSwatchPress = useCallback(
    (swatch: VerseActionSwatch) => {
      const verses = verseSelection?.verses ?? []
      // Read the selection first: closing drops the mirror this reads from.
      closeVerseActions()
      if (verses.length === 0) return
      // `remove` goes straight to the unguarded write: a user looking at a
      // highlight already has the permissions it needs (ADR 0016).
      if (swatch.state === 'remove') {
        void removeHighlight(swatch.color, verses).then((outcome) =>
          reportHighlightWriteError(outcome, onHighlightError),
        )
        return
      }
      switch (authGate) {
        case 'settling':
        case 'signed-out': {
          // The flow calls `signIn()` with no UI of its own, so the reader owns
          // this pre-step: hold the intent, ask, hand it over on confirm.
          // While bootstrap is still settling, hold the intent and wait. Opening
          // the sheet now would prompt a stored session; applying now would drop
          // a signed-out tap after the write reverts.
          pendingIntentRef.current = {
            color: swatch.color,
            verses,
            scope: { versionId, book, chapter },
          }
          if (authGate === 'signed-out') {
            setPrompt({ kind: 'sign-in', scope: { versionId, book, chapter } })
          }
          return
        }
        case 'unconfigured':
        case 'ready':
          // Fire-and-forget: the paint is optimistic inside `useHighlights`, so
          // the verse changes color on this frame instead of after the round-trip.
          void applyHighlight(swatch.color, verses).then((outcome) =>
            reportHighlightWriteError(outcome, onHighlightError),
          )
          return
        default: {
          const _exhaustive: never = authGate
          return _exhaustive
        }
      }
    },
    [
      verseSelection,
      closeVerseActions,
      removeHighlight,
      applyHighlight,
      authGate,
      onHighlightError,
      versionId,
      book,
      chapter,
    ],
  )

  const handleSignInConfirm = useCallback(() => {
    setPrompt(NO_PROMPT)
    // Straight back into the flow, which signs in, asks for consent if the grant
    // is still missing, and writes. The user never reselects the verse.
    replayPendingIntent()
  }, [replayPendingIntent])

  // "No Thanks", a swipe-down, a backdrop tap, and displacement all land here.
  // Every one discards the intent, and nothing is written.
  const handleSignInDismiss = useCallback(() => {
    pendingIntentRef.current = null
    setPrompt(NO_PROMPT)
  }, [])

  useEffect(() => {
    if (authGate === 'unconfigured' || authGate === 'settling') return
    if (prompt.kind !== 'none') return
    const pending = pendingIntentRef.current
    if (pending === null) return
    if (!sameScope(pending.scope, { versionId, book, chapter })) {
      pendingIntentRef.current = null
      return
    }
    switch (authGate) {
      case 'signed-out':
        setPrompt({ kind: 'sign-in', scope: pending.scope })
        return
      case 'ready':
        replayPendingIntent()
        return
      default: {
        const _exhaustive: never = authGate
        return _exhaustive
      }
    }
  }, [authGate, prompt.kind, versionId, book, chapter, replayPendingIntent])

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

  // The consumer override wins. Otherwise the native fallback runs, because
  // browser defaults do not work inside an Expo DOM WebView.
  const handleCopy = useCallback(
    async (data: BibleReaderShareData) => {
      try {
        if (consumerOnCopy) {
          await consumerOnCopy(data)
          return
        }
        await Clipboard.setStringAsync(data.text)
      } catch (error) {
        // Swallowed. A failed copy reads to the user like a dismissed sheet,
        // and there is nothing useful to say about it.
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

  // `shareData` rides in on `onVerseSelect`, so these handlers need no round-trip
  // back into the WebView. Read the data before `closeVerseActions` drops the
  // selection.
  const handleCopyPress = useCallback(() => {
    const data = verseSelection?.shareData
    closeVerseActions()
    if (data) void handleCopy(data)
  }, [verseSelection, handleCopy, closeVerseActions])

  const handleSharePress = useCallback(() => {
    const data = verseSelection?.shareData
    closeVerseActions()
    if (data) void handleShare(data)
  }, [verseSelection, handleShare, closeVerseActions])

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

  const BibleReaderDOM = getImpl('BibleReaderDom')
  const FootnoteContent = getImpl('FootnoteContent')

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
          highlights={highlights}
          verseActions={VERSE_ACTIONS}
          onVerseSelect={handleVerseSelect}
          clearSelectionSignal={clearSelectionSignal + internalClearCount}
          onSignInPress={signIn}
          onSignOutPress={guardedSignOut}
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
          // Yielded, not displaced. A prompt that takes over the sheet host
          // would fire this sheet's `onClose`, which clears the selection the
          // prompt's own answer still needs.
          isOpen={
            verseSelection !== null &&
            renderedPrompt.kind === 'none' &&
            !highlightPermissionFlow.isConfirming
          }
          reference={verseSelection?.reference ?? ''}
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
          isOpen={renderedPrompt.kind === 'sign-in'}
          onConfirm={handleSignInConfirm}
          onDismiss={handleSignInDismiss}
          theme={resolvedTheme}
        />
      )}
      {Platform.OS !== 'web' && (
        <HighlightConsentSheet
          isOpen={highlightPermissionFlow.isConfirming}
          onConfirm={highlightPermissionFlow.confirm}
          onDismiss={highlightPermissionFlow.decline}
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
