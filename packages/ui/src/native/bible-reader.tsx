import { useControllableState } from '@radix-ui/react-use-controllable-state'
import {
  deriveServerColors,
  useHighlightPermissionFlow,
  useYouVersion,
  useYVAuthOptional,
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
import { useCallback, useMemo, useRef, useState } from 'react'
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
 * A swatch press the reader is holding while it asks the user something. It
 * outlives the selection — the action sheet closes before the prompt opens, so
 * `verseSelection` is already `null` by the time the answer comes back.
 *
 * `scope` is load-bearing: verse numbers alone are not a passage. Replaying
 * them through a location the reader has since left would paint text the user
 * never selected — the same contract core's Pending Highlight carries
 * (ADR 0016).
 */
type PendingSwatchIntent = { color: string; verses: number[]; scope: HighlightScope }

/**
 * Which prompt the reader is showing on its own account, and — for `'sign-in'` —
 * the passage it was raised for. The scope is held here rather than read off
 * {@link PendingSwatchIntent} because the discard below runs during render,
 * where touching a ref is what `react-hooks/refs` forbids.
 */
type PromptState = { kind: 'none' } | { kind: 'sign-in'; scope: HighlightScope }

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
  | 'accessToken'
  | 'onSignInPress'
  | 'onSignOutPress'
  | 'onExternalLinkPress'
  | 'userInfo'
  // The reader owns its bottom scroll padding (tab bar + home indicator on iOS).
  | 'bottomScrollPadding'
  // `onVerseSelect` and `clearSelectionSignal` are deliberately kept — they are
  // the consumer's only handle on a selection. The reader taps both on the way
  // past: it mirrors the payload to raise the native verse action sheet, and
  // adds its own clears to the consumer's counter.
> & {
  theme?: 'light' | 'dark' | 'system'
  defaultBook?: string
  defaultChapter?: string
  defaultVersionId?: number
  onFootnotePress?: (data: FootnoteData) => Promise<void>
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  /**
   * Handle Copy yourself instead of the SDK's `expo-clipboard` fallback. Fired
   * by the native verse action sheet's Copy button, with the payload
   * `onVerseSelect` already carried.
   *
   * Native-only — on web the in-WebView popover handles Copy itself.
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

  const highlightPermissionFlow = useHighlightPermissionFlow({ versionId, book, chapter })
  const { highlights, scope: highlightScope, remove: removeHighlight } =
    highlightPermissionFlow.highlights

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
  const [verseSelection, setVerseSelection] = useState<BibleReaderVerseSelection | null>(null)
  // One-way DOM command, bumped on every exit from the sheet — with the popover
  // suppressed, nothing inside the WebView clears the selection any more. It is
  // *added* to the consumer's `clearSelectionSignal` rather than replacing it, so
  // both the public prop and the reader's own exits can clear.
  const [internalClearCount, setInternalClearCount] = useState(0)

  // The consent prompt is not in here — the flow owns that one, gated on
  // `highlightPermissionFlow.isConfirming`.
  const [prompt, setPrompt] = useState<PromptState>(NO_PROMPT)
  // A ref, not state: nothing renders from it, and the sign-in sheet's confirm
  // needs the value on the same tick it fires.
  const pendingIntentRef = useRef<PendingSwatchIntent | null>(null)

  // Discard a pending sign-in prompt when the reader leaves the passage it
  // belonged to. Same "adjust state when props change" pattern as the
  // Permission Flow's RESET: an effect would leave one frame where the sheet
  // for the old chapter is still open over the new one. A controlled consumer
  // can change book / chapter / versionId while the prompt is up.
  // `renderedPrompt` is what this frame paints — `setPrompt` alone would still
  // leave the sheet open for one render.
  //
  // The stale intent on the ref is left alone: this closes the sheet, so nothing
  // can fire `onConfirm`, the next swatch press overwrites it, and the confirm
  // handler re-checks the scope regardless.
  const currentScope: HighlightScope = { versionId, book, chapter }
  let renderedPrompt = prompt
  if (prompt.kind === 'sign-in' && !sameScope(prompt.scope, currentScope)) {
    renderedPrompt = NO_PROMPT
    setPrompt(NO_PROMPT)
  }

  const handleVerseSelect = useCallback(
    async (next: BibleReaderVerseSelection) => {
      setVerseSelection(next.verses.length > 0 ? next : null)
      await onVerseSelect?.(next)
    },
    [onVerseSelect],
  )

  const closeVerseActions = useCallback(() => {
    setVerseSelection(null)
    setInternalClearCount((count) => count + 1)
  }, [])

  // Which circles the tray shows, projected from the same painted array the
  // WebView renders — so a swatch can never disagree with the passage behind it.
  const swatches = useMemo(
    () =>
      buildVerseActionSwatches({
        verses: verseSelection?.verses ?? [],
        colors: deriveServerColors(highlights, highlightScope),
      }),
    [verseSelection, highlights, highlightScope],
  )

  const applyHighlight = highlightPermissionFlow.apply

  // A `null` auth means the consumer configured none at all, which is not the
  // same as signed out — there is nothing to sign in to, so no prompt.
  const needsSignIn = auth !== null && !auth.isAuthenticated

  const handleSwatchPress = useCallback(
    (swatch: VerseActionSwatch) => {
      const verses = verseSelection?.verses ?? []
      // Read the selection first: closing drops the mirror this reads from.
      closeVerseActions()
      if (verses.length === 0) return
      // `remove` goes straight to the unguarded write: a user looking at a
      // highlight already has the permissions it needs (ADR 0016).
      if (swatch.state === 'remove') {
        void removeHighlight(swatch.color, verses)
        return
      }
      if (needsSignIn) {
        // The flow calls `signIn()` with no UI of its own, so the reader owns
        // this pre-step: hold the intent, ask, hand it over on confirm.
        pendingIntentRef.current = {
          color: swatch.color,
          verses,
          scope: { versionId, book, chapter },
        }
        setPrompt({ kind: 'sign-in', scope: { versionId, book, chapter } })
        return
      }
      // Fire-and-forget: the paint is optimistic inside `useHighlights`, so the
      // verse changes color on this frame rather than after the round-trip.
      void applyHighlight(swatch.color, verses)
    },
    [
      verseSelection,
      closeVerseActions,
      removeHighlight,
      applyHighlight,
      needsSignIn,
      versionId,
      book,
      chapter,
    ],
  )

  const handleSignInConfirm = useCallback(() => {
    const pending = pendingIntentRef.current
    pendingIntentRef.current = null
    setPrompt(NO_PROMPT)
    // Straight back into the flow, which signs in, asks for consent if the grant
    // is still missing, and writes — without the user reselecting the verse.
    if (!pending) return
    // Belt for the during-render discard above: a confirm that races a
    // controlled location change must not hand verse numbers to the current
    // location-scoped flow.
    if (!sameScope(pending.scope, { versionId, book, chapter })) return
    void applyHighlight(pending.color, pending.verses)
  }, [applyHighlight, versionId, book, chapter])

  // "No Thanks", a swipe-down, a backdrop tap, and displacement all land here.
  // Every one of them discards the intent; nothing is written.
  const handleSignInDismiss = useCallback(() => {
    pendingIntentRef.current = null
    setPrompt(NO_PROMPT)
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

  // Consumer override wins, else the native fallback — browser defaults do not
  // work from inside an Expo DOM WebView.
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

  // `shareData` rides in on `onVerseSelect`, so these need no round-trip back
  // into the WebView. Read it before `closeVerseActions` drops the selection.
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
          verseActions={VERSE_ACTIONS}
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
          // Yielded rather than displaced: a prompt taking over the sheet host
          // would fire this sheet's `onClose`, clearing the selection its own
          // answer still needs.
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
