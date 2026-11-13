import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AccessibilityInfo,
  ActivityIndicator,
  Text as RNText,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type Text as RNTextInstance,
} from 'react-native'

import { Button } from '../components/ui'
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
import { decodeFontFamilyFromDom } from '../lib/reader-fonts'
import type { InternalLocaleProps } from '../lib/locale-props'
import type { InternalVersionFilterProps } from '../lib/version-filter-props'
import { versionGate } from '../lib/version-usability'
import { READER_LINE_SPACING } from '../stores/types/reader-line-spacing'
import { sansFace } from '../theme/fonts'
import type { BibleReaderBodyProps } from './bible-reader-body-props'
import { toHex6 } from './scripture/highlight-colors'
import { highlightEndRoom, Passage, type VerseFocusDim } from './scripture/passage'
import { usePassageStyle } from './scripture/passage-style'
import { buildVerseSelection, parseFocusPassageId } from './scripture/selection'
import { lineMultiple } from './scripture/styles'
import { focusLineBox, focusScrollOffset, type LineBox } from './scripture/verse-line'
import {
  chapterRef,
  chapterReference,
  footnoteFor,
  passageErrorKey,
  passageKey,
  usePassage,
  useVersionCopyright,
} from './scripture/use-passage'

type BibleReaderNativeProps = BibleReaderBodyProps &
  InternalVersionFilterProps &
  InternalLocaleProps

type BlockLayouts = {
  key: string | null
  byIndex: Map<number, { y: number; height: number }>
}

type VerseLineStore = {
  token: string
  byIndex: Map<number, ReadonlyMap<number, LineBox>>
}

const DEFAULT_FOCUS = {
  seq: 0,
  versionId: 0,
  passageId: '',
  scrollsToVerse: false,
  shouldFocus: false,
}
const DEFAULT_FONT_SIZE = 16
const MAX_WIDTH = 700
// Style spec §5: 32, Kotlin's 32dp (Swift uses 30). The gutter sets the wrap width,
// so lines break at the same words as the other native readers. The highlight pad
// is subtracted here and added back on the paragraph, so the words stay put and a
// full line's highlight can run past them.
const GUTTER = 32
// Swift shows the reference only in the toolbar, so the text opens under its vertical padding.
const TOP_PADDING = 16
const EMPTY_SELECTION: ReadonlySet<number> = new Set()
const SPINNER_DELAY_MS = 250
const NO_VERSES: ReadonlyMap<number, { text: string }> = new Map()

/** Chapter text drawn with React Native `<Text>`. */
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
    book = 'JHN',
    chapter = '1',
    versionId = 3034,
    versionDirections,
    fontSize = DEFAULT_FONT_SIZE,
    fontFamily,
    lineSpacing = READER_LINE_SPACING.DEFAULT,
    onFootnotePress,
    onExternalLinkPress,
    backgroundColor,
    foregroundColor,
    bottomScrollPadding = 0,
    permittedVersionIds,
    excludedVersionIds,
    permittedLanguageTags,
  } = props
  const tokens = useTokens()
  const { t } = useSdkTranslation()

  const { title: bookTitle, entry, isLoading: isBookLoading } = useBibleBookTitle(versionId, book)
  const versionLookup = useBibleVersionAbbreviation(versionId)
  const {
    abbreviation,
    isLoading: isVersionLoading,
    error: versionError,
    retry: retryVersion,
  } = versionLookup
  const copyright = useVersionCopyright(fetchBibleContent, versionId)
  const unavailable = !isBookLoading && isChapterMissing(entry, chapter)
  const gate = versionGate(
    versionId,
    { permittedVersionIds, excludedVersionIds, permittedLanguageTags },
    versionLookup,
  )
  const refused = gate === 'refused'
  // Waiting avoids painting this chapter before the provider's language list can refuse it.
  const awaitingLanguage = gate === 'checking'
  const versionLookupBlocked = gate === 'lookupFailed'
  const address = chapterRef(book, chapter)
  const load = usePassage(
    fetchBibleContent,
    versionId,
    !unavailable && gate === 'open' ? address : null,
  )
  const currentKey = passageKey(versionId, address)
  const passage = load.passage
  const isCurrent = passage !== null && passage.key === currentKey

  // Colours: overrides win over tokens; the mix and alpha helpers need #rrggbb.
  const background = hostColor(backgroundColor, 'backgroundColor') ?? tokens.background
  const ink = hostColor(foregroundColor, 'foregroundColor') ?? tokens.foreground
  const muted = foregroundColor === undefined ? tokens.mutedForeground : ink

  // By the rendered passage's version: the dimmed old chapter keeps its direction.
  const versionDirection = passage ? versionDirections?.get(passage.versionId) : undefined
  const { look, paint } = usePassageStyle({
    passage,
    highlights,
    fontSize,
    lineMultiple: lineMultiple(lineSpacing),
    fontFamily: decodeFontFamilyFromDom(fontFamily),
    direction: versionDirection,
    ink,
    background,
  })

  // ---- Selection ----
  // The name hooks keep the previous version's label while the next one loads.
  // A share from that window cannot be taken back, so the payload waits.
  const shareBookTitle = isBookLoading ? null : bookTitle
  const shareAbbreviation = isVersionLoading ? null : abbreviation
  // Prefer the loaded book title. Fall back to the API reference (marks stripped,
  // trimmed to the chapter) while the title loads.
  const footnoteReference =
    isCurrent && !isBookLoading
      ? `${bookTitle} ${chapterLabelForBook(entry, chapter)}`
      : chapterReference(passage?.reference)
  const [selected, setSelected] = useState<ReadonlySet<number>>(EMPTY_SELECTION)
  const latest = useRef({
    versionId,
    book,
    chapter,
    bookTitle: shareBookTitle,
    abbreviation: shareAbbreviation,
    footnoteReference,
    passage,
    selected,
    refused,
  })
  latest.current = {
    versionId,
    book,
    chapter,
    bookTitle: shareBookTitle,
    abbreviation: shareAbbreviation,
    footnoteReference,
    passage,
    selected,
    refused,
  }

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
    const selection = buildVerseSelection({
      versionId: now.versionId,
      book: now.book,
      chapter: now.chapter,
      verses,
      bookTitle: now.bookTitle,
      versionAbbreviation: now.abbreviation,
      verseTexts: now.passage?.parsed.verses ?? NO_VERSES,
    })
    Promise.resolve(handler(selection)).catch(console.error)
  }, [])

  const onVersePress = useCallback(
    (verse: number): void => {
      if (latest.current.refused) {
        return
      }
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
  // A cached name can arrive on the same turn as navigation, while the previous passage
  // is still loaded and this effect still sees the old selection.
  useEffect(() => {
    const now = latest.current
    if (now.refused || now.selected.size === 0 || now.passage?.key !== currentKey) {
      return
    }
    emit(now.selected)
  }, [shareBookTitle, shareAbbreviation, currentKey, emit, refused])

  useEffect(() => {
    if (!refused || latest.current.selected.size === 0) {
      return
    }
    setSelected(EMPTY_SELECTION)
    emit(EMPTY_SELECTION)
  }, [refused, emit])

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
    const data = {
      ...footnoteFor(latest.current.passage, verse, html),
      reference: latest.current.footnoteReference,
    }
    Promise.resolve(handler(data)).catch(console.error)
  }, [])

  // ---- Scroll and layout ----
  const scrollRef = useRef<ScrollView>(null)
  const viewportHeight = useRef(0)
  const passageTop = useRef(0)
  // Tagged with the passage they measured, so a focus never lands on the last chapter's positions.
  const blockLayouts = useRef<BlockLayouts>({ key: null, byIndex: new Map() })
  const verseLines = useRef<VerseLineStore>({ token: '', byIndex: new Map() })
  const lineTokenRef = useRef('')
  lineTokenRef.current = passage === null ? '' : `${passage.key}|${fontSize}|${lineSpacing}`
  const blockRefs = useRef(new Map<number, RNTextInstance>())
  const layoutKey = passage?.key ?? null
  const onBlockLayout = useCallback(
    (index: number, y: number, height: number): void => {
      if (blockLayouts.current.key !== layoutKey) {
        blockLayouts.current = { key: layoutKey, byIndex: new Map() }
      }
      blockLayouts.current.byIndex.set(index, { y, height })
    },
    [layoutKey],
  )
  const onVerseLines = useCallback(
    (index: number, boxes: ReadonlyMap<number, LineBox> | null): void => {
      if (boxes === null || boxes.size === 0) {
        return
      }
      const token = lineTokenRef.current
      if (verseLines.current.token !== token) {
        verseLines.current = { token, byIndex: new Map() }
      }
      verseLines.current.byIndex.set(index, boxes)
    },
    [],
  )
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
  const focusTarget = useMemo(() => {
    if (!verseFocus.shouldFocus || !verseFocus.scrollsToVerse) {
      return null
    }
    return parseFocusPassageId(verseFocus.passageId)
  }, [verseFocus.shouldFocus, verseFocus.scrollsToVerse, verseFocus.passageId])
  let probeVerses: readonly number[] | null = null
  if (
    focusTarget !== null &&
    isCurrent &&
    passage !== null &&
    passage.versionId === verseFocus.versionId &&
    focusTarget.book.toUpperCase() === book.toUpperCase() &&
    focusTarget.chapter === chapter
  ) {
    probeVerses = focusTarget.verses
  }
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
  const cancelLanding = useRef<() => void>(() => {})
  const handledRef = useRef<HandledVerseFocus>({ stream: focusStream, seq: 0 })
  useEffect(() => {
    if (refused) {
      cancelLanding.current()
      setFocusDim(null)
      return
    }
    if (renderedKey === null || passage === null) {
      return
    }
    const target = parseFocusPassageId(verseFocus.passageId)
    const matches =
      target === null ||
      (target.book.toUpperCase() === book.toUpperCase() && target.chapter === chapter)
    // A host that owns versionId can deliver this focus while the previous
    // version is still on screen. Consuming it now would skip the scroll
    // once the requested version arrives.
    if (!matches || verseFocus.versionId !== passage.versionId) {
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
      // request() keeps this seq and sets shouldFocus false. A landing already
      // scheduled would still scroll, dim, and acknowledge the old focus.
      if (!verseFocus.shouldFocus) {
        cancelLanding.current()
        setFocusDim(null)
      }
      return
    }
    const { scrollsToVerse } = requested
    const ack = { stream: focusStream, seq: verseFocus.seq }
    const blockIndex =
      target === null
        ? -1
        : passage.parsed.blocks.findIndex((b) => b.verses.some((v) => target.verses.includes(v)))
    // Block layouts land after commit; poll briefly instead of threading a layout counter.
    // A paragraph taller than the screen needs the verse's own line, which arrives with the text.
    let layoutTries = 0
    let lineTries = 0
    let frame: number | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    const land = (): void => {
      const layouts = blockLayouts.current
      const layout = layouts.key === passage.key ? layouts.byIndex.get(blockIndex) : undefined
      if (blockIndex >= 0 && layout === undefined && layoutTries < 10) {
        layoutTries += 1
        timer = setTimeout(land, 50)
        return
      }
      const stored =
        verseLines.current.token === lineTokenRef.current
          ? verseLines.current.byIndex.get(blockIndex)
          : undefined
      const needsVerseLine =
        layout !== undefined && scrollsToVerse && layout.height >= viewportHeight.current
      if (needsVerseLine && stored === undefined && lineTries < 10) {
        lineTries += 1
        timer = setTimeout(land, 50)
        return
      }
      if (layout !== undefined && scrollsToVerse) {
        const verseBox =
          needsVerseLine && stored !== undefined && target !== null
            ? focusLineBox(stored, target.verses)
            : null
        const top = passageTop.current + layout.y + (verseBox?.y ?? 0)
        const height = verseBox?.height ?? layout.height
        scrollRef.current?.scrollTo({
          y: focusScrollOffset(top, height, viewportHeight.current, TOP_PADDING),
          animated: true,
        })
      }
      // A verse this text omits (NIV Matthew 17:21) matches no block; dimming would dim every
      // verse. Clear instead, so an earlier focus does not stay bright.
      setFocusDim(target !== null && blockIndex >= 0 ? new Set(target.verses) : null)
      const node = blockRefs.current.get(blockIndex)
      if (node !== undefined) {
        AccessibilityInfo.sendAccessibilityEvent(node, 'focus')
      }
      callbacks.current.onVerseFocusApplied?.(ack)
    }
    // A newer request supersedes one still landing; its higher seq acks both. Reruns
    // without a new request return above, so a pending landing keeps its ack.
    cancelLanding.current()
    cancelLanding.current = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame)
      }
      if (timer !== null) {
        clearTimeout(timer)
      }
    }
    frame = requestAnimationFrame(land)
  }, [renderedKey, passage, verseFocus, appliedFocusSeq, focusStream, book, chapter, refused])

  // A version or chapter change drops the focus dim with the old text, and cancels a
  // focus still landing, which would otherwise dim or scroll the new text.
  useEffect(() => {
    setFocusDim(null)
    return () => cancelLanding.current()
  }, [currentKey])
  const clearDim = useCallback((): void => setFocusDim(null), [])

  // ---- Loading spinner, delayed so cache hits do not flash ----
  const [showSpinner, setShowSpinner] = useState(false)
  useEffect(() => {
    if (!load.loading && !awaitingLanguage) {
      setShowSpinner(false)
      return
    }
    const timer = setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS)
    return () => clearTimeout(timer)
  }, [load.loading, awaitingLanguage])

  let message: string | null = null
  if (refused || unavailable) {
    message = t('passageUnavailable')
  } else if (versionLookupBlocked && versionError !== null) {
    message = t(passageErrorKey(versionError))
  } else if (load.error !== null) {
    message = t(passageErrorKey(load.error))
  }

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
            paddingHorizontal: GUTTER - highlightEndRoom(fontSize),
            paddingTop: TOP_PADDING,
          }}
        >
          {message !== null ? (
            <View style={{ alignItems: 'center', gap: 16 }}>
              <RNText
                allowFontScaling={false}
                style={{
                  ...look.labelFace,
                  fontSize: 16,
                  lineHeight: 24,
                  color: muted,
                  textAlign: 'center',
                }}
              >
                {message}
              </RNText>
              {!refused &&
                !unavailable &&
                (versionLookupBlocked || load.error !== 'unavailable') && (
                  <Button
                    variant="outline"
                    onPress={versionLookupBlocked ? retryVersion : load.retry}
                  >
                    <Button.Text>{t('retry')}</Button.Text>
                  </Button>
                )}
            </View>
          ) : passage === null || (awaitingLanguage && passage.key === currentKey) ? (
            showSpinner && <ActivityIndicator accessibilityLabel={t('loading')} color={muted} />
          ) : (
            <View
              onLayout={(event: LayoutChangeEvent) => {
                passageTop.current = event.nativeEvent.layout.y
              }}
              pointerEvents={isCurrent ? 'auto' : 'none'}
              style={{ opacity: isCurrent ? 1 : 0.4 }}
            >
              <Passage
                key={passage.key}
                blocks={passage.parsed.blocks}
                look={look}
                selected={selected}
                paint={paint}
                focus={focusDim}
                onVersePress={onVersePress}
                onNotePress={onNotePress}
                onBlockLayout={onBlockLayout}
                onBlockRef={onBlockRef}
                probeVerses={probeVerses}
                onVerseLines={onVerseLines}
              />
            </View>
          )}

          {message === null && !awaitingLanguage && isCurrent && copyright.copyright !== null && (
            <RNText
              allowFontScaling={false}
              style={{
                alignSelf: 'center',
                maxWidth: 280,
                paddingTop: 16,
                marginBottom: 48,
                ...look.labelFace,
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
                      ...sansFace(tokens.fontFamily.sans, 700),
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
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator accessibilityLabel={t('loading')} color={muted} />
        </View>
      )}
    </View>
  )
}

const warnedColors = new Set<string>()

/** A host colour as `#rrggbb`; one the mixer cannot read warns once in development and falls back. */
function hostColor(color: string | undefined, prop: string): string | null {
  if (color === undefined) {
    return null
  }
  const hex = toHex6(color)
  if (hex === null && __DEV__ && !warnedColors.has(color)) {
    warnedColors.add(color)
    console.warn(
      `BibleReader: ${prop} "${color}" is not a colour the native reader can read; using the theme colour. Pass hex or rgb().`,
    )
  }
  return hex
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
