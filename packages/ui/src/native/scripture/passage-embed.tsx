import {
  deriveServerColors,
  useYouVersion,
  type Highlight,
} from '@youversion/platform-react-native-expo-core'
import type { FootnoteData } from '@youversion/platform-react-ui'
import { useCallback, useMemo, type ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { Button, Text } from '../../components/ui'
import { useTheme, useTokens } from '../../hooks'
import { useBibleVersionAbbreviation } from '../../hooks/use-bible-version-abbreviation'
import { useSdkTranslation } from '../../i18n/use-sdk-translation'
import type { InternalVersionFilterProps } from '../../lib/version-filter-props'
import { isUsableBibleVersion, isVersionIdDecidablyUnusable } from '../../lib/version-usability'
import { READER_LINE_SPACING } from '../../stores/types/reader-line-spacing'
import { sansFace } from '../../theme/fonts'
import { useSerifFace } from '../../theme/use-fonts'
import { highlightPaint, type HighlightPaint } from './highlight-colors'
import { Passage, type PassageLook } from './passage'
import { scripturePhase, verseSpanFromPassageId } from './reference-passage'
import { passageKey, usePassage } from './use-passage'

const EMPTY_SELECTION: ReadonlySet<number> = new Set()
const NO_FOCUS = null

type PassageFont = 'sans' | 'serif'

type PassageEmbedProps = {
  reference: string
  versionId: number
  highlights: Highlight[]
  fontSize: number
  font: PassageFont
  onFootnotePress?: (data: FootnoteData) => void | Promise<void>
}

export function PassageEmbed({
  reference,
  versionId,
  highlights,
  fontSize,
  font,
  onFootnotePress,
}: PassageEmbedProps): ReactNode {
  const { t } = useSdkTranslation()
  const theme = useTheme()
  const tokens = useTokens()
  const serifFaceFor = useSerifFace()
  const { fetchBibleContent, permittedVersionIds, excludedVersionIds, permittedLanguageTags } =
    useYouVersion()
  const filters: InternalVersionFilterProps = {
    permittedVersionIds,
    excludedVersionIds,
    permittedLanguageTags,
  }
  const span = useMemo(() => verseSpanFromPassageId(reference), [reference])
  const idRefused = isVersionIdDecidablyUnusable(versionId, filters)
  const needsLanguage = permittedLanguageTags !== undefined && !idRefused
  const version = useBibleVersionAbbreviation(versionId, { enabled: needsLanguage })
  const awaitingLanguage = needsLanguage && version.isLoading
  const versionLookupBlocked = needsLanguage && version.error !== null
  const languageRefused =
    needsLanguage &&
    !version.isLoading &&
    version.error === null &&
    !isUsableBibleVersion({ id: versionId, languageTag: version.languageId ?? undefined }, filters)
  const refused = idRefused || languageRefused
  const enabled = span !== null && !refused && !awaitingLanguage && !versionLookupBlocked
  const load = usePassage(
    fetchBibleContent,
    versionId,
    span?.book ?? 'GEN',
    span?.chapter ?? '1',
    enabled,
  )
  const phase = scripturePhase({
    span,
    versionId,
    refused,
    awaitingLanguage,
    versionLookupBlocked,
    versionError: version.error,
    passage: load.passage,
    loading: load.loading,
    error: load.error,
  })

  const rtl = phase.kind === 'passage' ? phase.loaded.parsed.rtl : false
  const background = tokens.card
  const look = useMemo<PassageLook>(
    () => ({
      fontSize,
      lineSpacing: READER_LINE_SPACING.DEFAULT,
      rtl,
      face: (weight, italic) =>
        font === 'sans'
          ? sansFace(tokens.fontFamily.sans, weight)
          : serifFaceFor(weight, italic ? 'italic' : 'normal'),
      labelFace: sansFace(tokens.fontFamily.sans, 400),
      ink: tokens.foreground,
      wj: tokens.wj,
      underline: tokens.border,
      background,
    }),
    [fontSize, rtl, font, tokens, serifFaceFor, background],
  )

  const paint = useMemo(() => {
    const current = load.passage
    if (
      current === null ||
      span === null ||
      current.key !== passageKey(versionId, span.book, span.chapter)
    ) {
      return new Map<number, HighlightPaint>()
    }
    const colors = deriveServerColors(highlights, {
      versionId: current.versionId,
      book: current.book,
      chapter: current.chapter,
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
  }, [highlights, load.passage, span, versionId, theme, background, tokens.primaryForeground])

  const onNotePress = useCallback(
    (verse: number | null, html: string) => {
      const current = load.passage
      if (onFootnotePress === undefined || current === null || span === null) {
        return
      }
      if (current.key !== passageKey(versionId, span.book, span.chapter)) {
        return
      }
      const info = verse === null ? undefined : current.parsed.verses.get(verse)
      void Promise.resolve(
        onFootnotePress({
          verseNum: verse === null ? '' : String(verse),
          notes: info?.notes ?? [html],
          verseHtml: info?.html ?? '',
          reference: current.reference,
        }),
      )
    },
    [load.passage, onFootnotePress, span, versionId],
  )

  if (phase.kind === 'loading') {
    return (
      <View testID="scripture-loading" accessibilityRole="progressbar" style={styles.status}>
        <ActivityIndicator accessibilityLabel={t('loading')} color={tokens.mutedForeground} />
      </View>
    )
  }

  if (phase.kind !== 'passage') {
    const message =
      phase.kind === 'offline'
        ? t('offlineConnectionLostMessage')
        : phase.kind === 'failed'
          ? t('generic.requestErrorBody')
          : t('passageUnavailable')
    const retry =
      phase.kind === 'unavailable' ? null : phase.retry === 'version' ? version.retry : load.retry
    return (
      <View testID="scripture-error" style={styles.status}>
        <Text variant="muted" style={styles.message}>
          {message}
        </Text>
        {retry !== null ? (
          <Button variant="outline" onPress={retry} testID="scripture-retry">
            <Button.Text>{t('retry')}</Button.Text>
          </Button>
        ) : null}
      </View>
    )
  }

  return (
    <View testID="scripture-passage">
      <Passage
        blocks={phase.blocks}
        look={look}
        selected={EMPTY_SELECTION}
        paint={paint}
        focus={NO_FOCUS}
        onVersePress={noop}
        onNotePress={onNotePress}
        onBlockLayout={noop}
        onBlockRef={noop}
      />
    </View>
  )
}

function noop(): void {}

const styles = StyleSheet.create({
  status: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  message: {
    textAlign: 'center',
  },
})
