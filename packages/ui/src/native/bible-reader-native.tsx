import { deriveServerColors } from '@youversion/platform-react-native-expo-core'
import type { FootnoteData } from '@youversion/platform-react-ui'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Text as RNText,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type Text as RNTextInstance,
} from 'react-native'

import { Button } from '../components/ui'
import type { BibleReaderProps } from '../dom/bible-reader'
import {
  applyMountedVerseFocus,
  handledSeqForStream,
  type HandledVerseFocus,
} from '../dom/apply-verse-focus'
import { useBibleBookTitle } from '../hooks/use-bible-book-title'
import { useBibleVersionAbbreviation } from '../hooks/use-bible-version-abbreviation'
import { useTokens } from '../hooks/use-tokens'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { chapterLabelForBook, type BookCatalogEntry } from '../lib/bible-book-title'
import { decodeFontFamilyFromDom, INTER_FONT } from '../lib/reader-fonts'
import type { InternalLocaleProps } from '../lib/locale-props'
import type { InternalVersionFilterProps } from '../lib/version-filter-props'
import { READER_LINE_SPACING } from '../stores/types/reader-line-spacing'
import { fontMapKey } from '../theme/fonts'
import { useSerifFamily, useSerifReady } from '../theme/use-fonts'
import { highlightPaint, toHex6, type HighlightPaint } from './scripture/highlight-colors'
import { Passage, type PassageLook, type VerseFocusDim } from './scripture/passage'
import { buildVerseSelection, parseFocusPassageId } from './scripture/selection'
import { removeImpl, setImpl } from './component-impls'
import { passageKey, usePassage, useVersionCopyright } from './scripture/use-passage'

type BibleReaderNativeProps = BibleReaderProps & InternalVersionFilterProps & InternalLocaleProps

const DEFAULT_FOCUS = {
  seq: 0,
  versionId: 0,
  passageId: '',
  scrollsToVerse: false,
  shouldFocus: false,
}
const DEFAULT_FONT_SIZE = 16
const MAX_WIDTH = 700
const GUTTER = 16
const HEADER_TOP = 48
const EMPTY_SELECTION: ReadonlySet<number> = new Set()
const SPINNER_DELAY_MS = 250
// A system serif until the brand serif registers. Naming the brand face early measures
// in the system font, and Fabric keeps that measure after the face lands.
const SERIF_STANDIN = Platform.select({ ios: 'Georgia', default: 'serif' })

/**
 * POC: the `BibleReaderDom` contract drawn with React Native `<Text>`, no WebView.
 * Same props as the DOM impl, so the host swaps it through the impl registry.
 */
export function BibleReaderNative(props: BibleReaderNativeProps): ReactNode {
  const {
    fetchBibleContent,
    highlights,
    onVerseSelect,
    clearSelectionSignal = 0,
    verseFocus = DEFAULT_FOCUS,
    appliedFocusSeq = 0,
    focusStream = 0,
    onVerseFocusApplied,
    theme = 'light',
    book = 'JHN',
    chapter = '1',
    versionId = 3034,
    fontSize = DEFAULT_FONT_SIZE,
    fontFamily,
    lineSpacing = READER_LINE_SPACING.DEFAULT,
    onFootnotePress,
    onExternalLinkPress,
    backgroundColor,
    foregroundColor,
    bottomScrollPadding = 0,
  } = props
  const tokens = useTokens()
  const { t } = useSdkTranslation()
  const serifFamily = useSerifFamily()
  const serifReady = useSerifReady()

  const { title: bookTitle, entry, isLoading: isBookLoading } = useBibleBookTitle(versionId, book)
  const { abbreviation } = useBibleVersionAbbreviation(versionId)
  const copyright = useVersionCopyright(fetchBibleContent, versionId)
  const unavailable = !isBookLoading && isChapterMissing(entry, chapter)
  const load = usePassage(fetchBibleContent, versionId, book, chapter, !unavailable)
  const currentKey = passageKey(versionId, book, chapter)
  const passage = load.passage
  const isCurrent = passage !== null && passage.key === currentKey

  // Colours: overrides win over tokens; the mix and alpha helpers need #rrggbb.
  const background = toHex6(backgroundColor ?? '') ?? tokens.background
  const ink = toHex6(foregroundColor ?? '') ?? tokens.foreground
  const muted = foregroundColor === undefined ? tokens.mutedForeground : ink

  const isSans = decodeFontFamilyFromDom(fontFamily) === INTER_FONT
  const look = useMemo<PassageLook>(
    () => ({
      fontSize,
      lineSpacing,
      rtl: passage?.parsed.rtl ?? false,
      // Inter ships no italic here, so sans keeps the upright face.
      face: (weight, italic) =>
        isSans
          ? fontMapKey(tokens.fontFamily.sans, weight, 'normal')
          : serifReady
            ? fontMapKey(serifFamily, weight, italic ? 'italic' : 'normal')
            : SERIF_STANDIN,
      labelFace: fontMapKey(tokens.fontFamily.sans, 400, 'normal'),
      ink,
      wj: tokens.wj,
      underline: tokens.border,
    }),
    [fontSize, lineSpacing, passage?.parsed.rtl, isSans, tokens, serifFamily, serifReady, ink],
  )

  const paint = useMemo(() => {
    const colors = deriveServerColors(Array.isArray(highlights) ? highlights : [], {
      versionId,
      book,
      chapter,
    })
    const byColor = new Map<string, HighlightPaint>()
    const map = new Map<number, HighlightPaint>()
    for (const [verse, color] of Object.entries(colors)) {
      const fill =
        byColor.get(color) ?? highlightPaint(color, theme, background, tokens.primaryForeground)
      byColor.set(color, fill)
      map.set(Number(verse), fill)
    }
    return map
  }, [highlights, versionId, book, chapter, theme, background, tokens.primaryForeground])

  // ---- Selection ----
  const [selected, setSelected] = useState<ReadonlySet<number>>(EMPTY_SELECTION)
  const latest = useRef({ versionId, book, chapter, bookTitle, abbreviation, passage, selected })
  latest.current = { versionId, book, chapter, bookTitle, abbreviation, passage, selected }

  // Hosts pass fresh callbacks each render; read them through a ref so effects keyed on
  // `emit` do not refire (and loop) every time the host rerenders from a selection.
  const callbacks = useRef({ onVerseSelect, onFootnotePress, onVerseFocusApplied })
  callbacks.current = { onVerseSelect, onFootnotePress, onVerseFocusApplied }

  const emit = useCallback((verses: ReadonlySet<number>): void => {
    const handler = callbacks.current.onVerseSelect
    if (handler === undefined) {
      return
    }
    const now = latest.current
    const verseTexts = new Map<number, string>()
    for (const [verse, info] of now.passage?.parsed.verses ?? []) {
      verseTexts.set(verse, info.text)
    }
    const selection = buildVerseSelection({
      versionId: now.versionId,
      book: now.book,
      chapter: now.chapter,
      verses,
      bookTitle: now.bookTitle,
      versionAbbreviation: now.abbreviation,
      verseTexts,
    })
    Promise.resolve(handler(selection)).catch(console.error)
  }, [])

  const onVersePress = useCallback(
    (verse: number): void => {
      const next = new Set(latest.current.selected)
      if (!next.delete(verse)) {
        next.add(verse)
      }
      setSelected(next)
      emit(next)
    },
    [emit],
  )

  // The sheet's reference reads "JHN 3:16" until the names land, so resend once they do.
  useEffect(() => {
    if (latest.current.selected.size > 0) {
      emit(latest.current.selected)
    }
  }, [bookTitle, abbreviation, emit])

  // Navigation clears the selection and tells the host, which closes the verse sheet.
  const locationRef = useRef(currentKey)
  useEffect(() => {
    if (locationRef.current === currentKey) {
      return
    }
    locationRef.current = currentKey
    if (latest.current.selected.size > 0) {
      setSelected(EMPTY_SELECTION)
      emit(EMPTY_SELECTION)
    }
  }, [currentKey, emit])

  // Only a change clears; the value at mount never does.
  const clearRef = useRef(clearSelectionSignal)
  useEffect(() => {
    if (clearRef.current === clearSelectionSignal) {
      return
    }
    clearRef.current = clearSelectionSignal
    if (latest.current.selected.size > 0) {
      setSelected(EMPTY_SELECTION)
      emit(EMPTY_SELECTION)
    }
  }, [clearSelectionSignal, emit])

  // ---- Footnotes ----
  const onNotePress = useCallback((verse: number | null, html: string): void => {
    const handler = callbacks.current.onFootnotePress
    if (handler === undefined) {
      return
    }
    const current = latest.current.passage
    const info = verse === null ? undefined : current?.parsed.verses.get(verse)
    const data: FootnoteData = {
      verseNum: verse === null ? '' : String(verse),
      notes: info?.notes ?? [html],
      verseHtml: info?.html ?? '',
      reference: current?.reference,
    }
    Promise.resolve(handler(data)).catch(console.error)
  }, [])

  // ---- Scroll and layout ----
  const scrollRef = useRef<ScrollView>(null)
  const viewportHeight = useRef(0)
  const passageTop = useRef(0)
  const blockLayouts = useRef(new Map<number, { y: number; height: number }>())
  const blockRefs = useRef(new Map<number, RNTextInstance>())
  const onBlockLayout = useCallback((index: number, y: number, height: number): void => {
    blockLayouts.current.set(index, { y, height })
  }, [])
  const onBlockRef = useCallback((index: number, node: RNTextInstance | null): void => {
    if (node === null) {
      blockRefs.current.delete(index)
    } else {
      blockRefs.current.set(index, node)
    }
  }, [])

  // A new book or chapter starts at the top; a version swap keeps the reader's place.
  const shownChapter = useRef<string | null>(null)
  const renderedKey = isCurrent ? passage.key : null
  useEffect(() => {
    if (renderedKey === null) {
      return
    }
    const chapterId = `${book}.${chapter}`
    if (shownChapter.current !== null && shownChapter.current !== chapterId) {
      scrollRef.current?.scrollTo({ y: 0, animated: false })
    }
    shownChapter.current = chapterId
  }, [renderedKey, book, chapter])

  // ---- Verse focus ----
  const [focusDim, setFocusDim] = useState<VerseFocusDim>(null)
  const handledRef = useRef<HandledVerseFocus>({ stream: focusStream, seq: 0 })
  useEffect(() => {
    if (renderedKey === null || passage === null) {
      return
    }
    const target = parseFocusPassageId(verseFocus.passageId)
    const matches =
      target === null ||
      (target.book.toUpperCase() === book.toUpperCase() && target.chapter === chapter)
    if (!matches) {
      return
    }
    let requested: { scrollsToVerse: boolean } | null = null
    const handled = applyMountedVerseFocus(
      {
        focusReference: (_reference, scrollsToVerse) => {
          requested = { scrollsToVerse: scrollsToVerse ?? true }
        },
      },
      verseFocus,
      handledSeqForStream(handledRef.current, focusStream),
      appliedFocusSeq,
    )
    handledRef.current = { stream: focusStream, seq: handled }
    if (requested === null) {
      return
    }
    const { scrollsToVerse } = requested
    const ack = { stream: focusStream, seq: verseFocus.seq }
    const blockIndex =
      target === null
        ? -1
        : passage.parsed.blocks.findIndex((b) => b.verses.some((v) => target.verses.includes(v)))
    // Block layouts land after commit; poll briefly instead of threading a layout counter.
    let tries = 0
    const land = (): void => {
      const layout = blockLayouts.current.get(blockIndex)
      if (blockIndex >= 0 && layout === undefined && tries < 10) {
        tries += 1
        setTimeout(land, 50)
        return
      }
      if (layout !== undefined && scrollsToVerse) {
        const top = passageTop.current + layout.y
        const offset =
          layout.height < viewportHeight.current
            ? top + layout.height / 2 - viewportHeight.current / 2
            : top - GUTTER
        scrollRef.current?.scrollTo({ y: Math.max(0, offset), animated: true })
      }
      if (target !== null) {
        setFocusDim(new Set(target.verses))
      }
      const node = blockRefs.current.get(blockIndex)
      if (node !== undefined) {
        AccessibilityInfo.sendAccessibilityEvent(node, 'focus')
      }
      callbacks.current.onVerseFocusApplied?.(ack)
    }
    requestAnimationFrame(land)
  }, [renderedKey, passage, verseFocus, appliedFocusSeq, focusStream, book, chapter])

  // A version or chapter change drops any focus dim with the old text.
  useEffect(() => {
    setFocusDim(null)
  }, [currentKey])
  const clearDim = useCallback((): void => setFocusDim(null), [])

  // ---- Loading spinner, delayed so cache hits do not flash ----
  const [showSpinner, setShowSpinner] = useState(false)
  useEffect(() => {
    if (!load.loading) {
      setShowSpinner(false)
      return
    }
    const timer = setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS)
    return () => clearTimeout(timer)
  }, [load.loading])

  // The DOM reader sets the book and chapter header in sans whatever the reader font.
  const headerFace = fontMapKey(tokens.fontFamily.sans, 400, 'normal')
  const chapterLabel = chapterLabelForBook(entry, chapter)
  const message = unavailable
    ? t('passageUnavailable')
    : load.error === 'offline'
      ? t('offlineConnectionLostMessage')
      : load.error === 'unavailable'
        ? t('passageUnavailable')
        : null

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <ScrollView
        ref={scrollRef}
        onLayout={(event) => {
          viewportHeight.current = event.nativeEvent.layout.height
        }}
        onTouchStart={focusDim === null ? undefined : clearDim}
        onScrollBeginDrag={focusDim === null ? undefined : clearDim}
        contentContainerStyle={{ paddingBottom: bottomScrollPadding }}
      >
        <View
          style={{
            alignSelf: 'center',
            width: '100%',
            maxWidth: MAX_WIDTH + GUTTER * 2,
            paddingHorizontal: GUTTER,
            paddingTop: HEADER_TOP,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <RNText
              allowFontScaling={false}
              style={{
                fontFamily: headerFace,
                fontSize: fontSize * 1.3,
                lineHeight: fontSize * 1.3 * 1.25,
                color: muted,
                opacity: focusDim === null ? 1 : 0.35,
              }}
            >
              {bookTitle ?? ''}
            </RNText>
            <RNText
              allowFontScaling={false}
              style={{
                fontFamily: headerFace,
                fontSize: fontSize * 2.2,
                lineHeight: fontSize * 2.2 * 1.2,
                color: muted,
                opacity: focusDim === null ? 1 : 0.35,
              }}
            >
              {chapterLabel}
            </RNText>
          </View>

          {message !== null ? (
            <View style={{ alignItems: 'center', gap: 16 }}>
              <RNText
                allowFontScaling={false}
                style={{
                  fontFamily: look.labelFace,
                  fontSize: 16,
                  lineHeight: 24,
                  color: muted,
                  textAlign: 'center',
                }}
              >
                {message}
              </RNText>
              {!unavailable && (
                <Button variant="outline" onPress={load.retry}>
                  <Button.Text>{t('retry')}</Button.Text>
                </Button>
              )}
            </View>
          ) : passage === null ? (
            <ActivityIndicator accessibilityLabel={t('loading')} color={muted} />
          ) : (
            <View
              onLayout={(event: LayoutChangeEvent) => {
                passageTop.current = event.nativeEvent.layout.y
              }}
              pointerEvents={isCurrent ? 'auto' : 'none'}
              style={{ opacity: isCurrent ? 1 : 0.4 }}
            >
              <Passage
                blocks={passage.parsed.blocks}
                look={look}
                selected={selected}
                paint={paint}
                focus={focusDim}
                onVersePress={onVersePress}
                onNotePress={onNotePress}
                onBlockLayout={onBlockLayout}
                onBlockRef={onBlockRef}
              />
            </View>
          )}

          {message === null && isCurrent && copyright.copyright !== null && (
            <RNText
              allowFontScaling={false}
              style={{
                alignSelf: 'center',
                maxWidth: 280,
                paddingTop: 16,
                marginBottom: 48,
                fontFamily: look.labelFace,
                fontSize: 12,
                lineHeight: 16,
                color: muted,
                textAlign: 'center',
              }}
            >
              {copyright.copyright}
              {copyright.publisherUrl !== null && onExternalLinkPress !== undefined && (
                <>
                  {' '}
                  <RNText
                    accessibilityRole="link"
                    onPress={() => {
                      const url = copyright.publisherUrl
                      if (url !== null) {
                        Promise.resolve(onExternalLinkPress(url)).catch(console.error)
                      }
                    }}
                    style={{
                      fontFamily: fontMapKey(tokens.fontFamily.sans, 700, 'normal'),
                      textDecorationLine: 'underline',
                    }}
                  >
                    {t('learnMore')}
                  </RNText>
                </>
              )}
            </RNText>
          )}
        </View>
      </ScrollView>
      {showSpinner && passage !== null && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: GUTTER, left: 0, right: 0, alignItems: 'center' }}
        >
          <ActivityIndicator accessibilityLabel={t('loading')} color={muted} />
        </View>
      )}
    </View>
  )
}

/** Web's `chapterUnavailable`: the catalog lists chapters and this one (nor the intro) is not among them. */
function isChapterMissing(entry: BookCatalogEntry | null, chapter: string): boolean {
  if (entry === null || entry.chapters === null) {
    return false
  }
  if (entry.intro !== null && entry.intro.id === chapter) {
    return false
  }
  return !entry.chapters.some((c) => c.id === chapter)
}

/**
 * POC switch: draw `BibleReader` scripture with native `<Text>` or the Expo DOM reader.
 * Default is `'dom'`. Remount the reader after a change so it picks up the new impl.
 */
export function unstable_setReaderRenderer(renderer: 'dom' | 'native'): void {
  if (renderer === 'native') {
    setImpl('BibleReaderDom', BibleReaderNative)
  } else {
    removeImpl('BibleReaderDom')
  }
}
