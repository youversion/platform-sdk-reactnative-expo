import { useHighlightPaint, useYouVersion } from '@youversion/platform-react-native-expo-core'
import type {
  BibleTextViewProps as WebBibleTextViewProps,
  FootnoteData,
} from '@youversion/platform-react-ui'
import { useCallback, useMemo, useRef, type ReactNode } from 'react'
import { ActivityIndicator, View } from 'react-native'

import { Button, Text } from '../components/ui'
import { useBibleVersionAbbreviation } from '../hooks/use-bible-version-abbreviation'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import type { FontFamily } from '../lib/reader-fonts'
import type { InternalVersionFilterProps } from '../lib/version-filter-props'
import { versionGate, type VersionGate } from '../lib/version-usability'
import { READER_LINE_SPACING } from '../stores/types/reader-line-spacing'
import { highlightScopeFor } from './highlight-scope'
import { highlightEndRoom, Passage } from './scripture/passage'
import { usePassageStyle } from './scripture/passage-style'
import { visibleBlocks } from './scripture/parse-passage'
import { normalizeVerses } from './scripture/selection'
import { lineMultiple } from './scripture/styles'
import {
  footnoteFor,
  passageErrorKey,
  passageKey,
  passageRefFor,
  usePassage,
  type PassageError,
  type SuppliedPassageHtml,
} from './scripture/use-passage'

type WebPassageState = NonNullable<WebBibleTextViewProps['passageState']>

export type BibleTextViewPassageState = Omit<WebPassageState, 'error'> & {
  error?: { message: string; name?: string; status?: number; code?: string } | null
}

export type BibleTextViewNativeProps = {
  reference: string
  versionId: number
  fontSize: number
  /** Line box as a multiple of `fontSize`. A finite value above 0 is used as given. */
  lineHeight?: number
  fontFamily?: FontFamily
  showVerseNumbers?: boolean
  renderNotes?: boolean
  selectedVerses?: readonly number[]
  onVerseSelect?: (verses: number[]) => Promise<void>
  /** Absent hides footnote markers. A note nobody can open does not draw. */
  onFootnotePress?: (data: FootnoteData) => Promise<void>
  scriptureDirection?: 'ltr' | 'rtl'
  /** Supplied passage. Skips the fetch and the version gate. */
  passageState?: BibleTextViewPassageState
}

/**
 * A USFM passage drawn with the reader's `Passage`. Grows with its text.
 * Reads the scheme from `ThemeContext`, so a theme override wraps it.
 */
export function BibleTextViewNative({
  reference,
  versionId,
  fontSize,
  lineHeight,
  fontFamily,
  showVerseNumbers = true,
  renderNotes = true,
  selectedVerses,
  onVerseSelect,
  onFootnotePress,
  scriptureDirection,
  passageState,
}: BibleTextViewNativeProps): ReactNode {
  const { fetchBibleContent, permittedVersionIds, excludedVersionIds, permittedLanguageTags } =
    useYouVersion()
  const { t } = useSdkTranslation()
  const suppliedMode = passageState !== undefined
  const lookup = useBibleVersionAbbreviation(versionId, {
    enabled: !suppliedMode && permittedLanguageTags !== undefined,
  })
  const requested = useMemo(() => passageRefFor(reference), [reference])
  const filters: InternalVersionFilterProps = {
    permittedVersionIds,
    excludedVersionIds,
    permittedLanguageTags,
  }
  const gate: VersionGate = suppliedMode
    ? 'open'
    : requested === null
      ? 'refused'
      : versionGate(versionId, filters, lookup)
  const hostError = hostPassageError(passageState)
  const hostHtml = hostPassageHtml(passageState)
  const hostRef = hostHtml === null ? null : (passageRefFor(hostHtml.id) ?? requested)
  const address = hostRef ?? (suppliedMode || gate !== 'open' ? null : requested)
  const supplied: SuppliedPassageHtml | null =
    hostHtml !== null && address !== null
      ? { content: hostHtml.content, reference: hostHtml.reference }
      : null
  const load = usePassage(fetchBibleContent, versionId, address, supplied)
  // Intros load as passages but have no numeric chapter for paint.
  const highlights = useHighlightPaint(highlightScopeFor(reference, versionId))
  const multiple = resolvedLineMultiple(lineHeight)
  const { look, paint } = usePassageStyle({
    passage: load.passage,
    highlights,
    fontSize,
    lineMultiple: multiple,
    fontFamily,
    direction: scriptureDirection,
  })
  const selected = useMemo(() => new Set(selectedVerses ?? []), [selectedVerses])
  const drawNotes = renderNotes && onFootnotePress !== undefined
  const parsedBlocks = load.passage?.parsed.blocks
  const blocks = useMemo(
    () => visibleBlocks(parsedBlocks ?? [], { verseNumbers: showVerseNumbers, notes: drawNotes }),
    [drawNotes, parsedBlocks, showVerseNumbers],
  )
  const latest = useRef({
    passage: load.passage,
    onVerseSelect,
    onFootnotePress,
    selected,
  })
  latest.current = { passage: load.passage, onVerseSelect, onFootnotePress, selected }
  const pressVerse = useCallback((verse: number): void => {
    const now = latest.current
    if (now.onVerseSelect === undefined) {
      return
    }
    const next = new Set(now.selected)
    if (!next.delete(verse)) {
      next.add(verse)
    }
    Promise.resolve(now.onVerseSelect(normalizeVerses(next))).catch(console.error)
  }, [])
  const onNotePress = useCallback((verse: number | null, html: string): void => {
    const now = latest.current
    if (now.onFootnotePress === undefined) {
      return
    }
    Promise.resolve(now.onFootnotePress(footnoteFor(now.passage, verse, html))).catch(console.error)
  }, [])

  // Supplied mode never paints a retained fetch: the host owns passage, loading, and error.
  const passage =
    suppliedMode && (hostHtml === null || address === null) ? null : load.passage
  const hostLoading = suppliedMode && (passageState?.loading ?? false)
  const currentKey = address === null ? null : passageKey(versionId, address)
  const isCurrent = passage !== null && currentKey !== null && passage.key === currentKey
  let message: string | null = null
  let onRetry: (() => void) | null = null
  if (suppliedMode) {
    if (hostError !== null) {
      message = t(passageErrorKey(hostError))
    } else if (hostLoading && passage === null) {
      // Spinner below. Do not surface a prior fetch error while the host is loading.
    } else if (hostHtml !== null && address === null) {
      message = t('passageUnavailable')
    } else if (passage === null) {
      // Idle empty supplied state — not a forever spinner (fetch is disabled).
      message = t('passageUnavailable')
    } else if (load.error !== null) {
      message = t(passageErrorKey(load.error))
    }
  } else if (gate === 'refused') {
    message = t('passageUnavailable')
  } else if (gate === 'lookupFailed' && lookup.error !== null) {
    message = t(passageErrorKey(lookup.error))
    onRetry = lookup.retry
  } else if (load.error !== null) {
    message = t(passageErrorKey(load.error))
    if (load.error !== 'unavailable') {
      onRetry = load.retry
    }
  }

  if (message !== null) {
    return (
      <View>
        <Text variant="muted">{message}</Text>
        {onRetry !== null && (
          <Button variant="outline" onPress={onRetry}>
            <Button.Text>{t('retry')}</Button.Text>
          </Button>
        )}
      </View>
    )
  }
  if (passage === null) {
    return <ActivityIndicator accessibilityLabel={t('loading')} />
  }
  return (
    <View
      pointerEvents={isCurrent ? 'auto' : 'none'}
      style={{
        // Highlight paint runs past the words — keep that room inside the host box.
        paddingHorizontal: highlightEndRoom(fontSize),
        backgroundColor: look.background,
        opacity: isCurrent ? 1 : 0.4,
      }}
    >
      <Passage
        key={passage.key}
        blocks={blocks}
        look={look}
        selected={selected}
        paint={paint}
        focus={null}
        onVersePress={onVerseSelect === undefined ? undefined : pressVerse}
        onNotePress={onNotePress}
      />
    </View>
  )
}

function resolvedLineMultiple(lineHeight: number | undefined): number {
  if (lineHeight !== undefined && Number.isFinite(lineHeight) && lineHeight > 0) {
    return lineHeight
  }
  return lineMultiple(READER_LINE_SPACING.DEFAULT)
}

function hostPassageError(state: BibleTextViewPassageState | undefined): PassageError | null {
  if (state?.error == null) {
    return null
  }
  if (state.error.status === 403 || state.error.status === 404) {
    return 'unavailable'
  }
  return 'failed'
}

function hostPassageHtml(
  state: BibleTextViewPassageState | undefined,
): { id: string; content: string; reference: string } | null {
  if (state === undefined || state.error != null || state.passage == null) {
    return null
  }
  return state.passage
}
