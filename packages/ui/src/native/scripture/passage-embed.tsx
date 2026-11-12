import { useYouVersion, type Highlight } from '@youversion/platform-react-native-expo-core'
import type { FootnoteData } from '@youversion/platform-react-ui'
import { useCallback, useMemo, type ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { Button, Text } from '../../components/ui'
import { useTokens } from '../../hooks'
import { useBibleVersionAbbreviation } from '../../hooks/use-bible-version-abbreviation'
import { useSdkTranslation } from '../../i18n/use-sdk-translation'
import { INTER_FONT } from '../../lib/reader-fonts'
import type { InternalVersionFilterProps } from '../../lib/version-filter-props'
import { isUsableBibleVersion, isVersionIdDecidablyUnusable } from '../../lib/version-usability'
import { READER_LINE_SPACING } from '../../stores/types/reader-line-spacing'
import { Passage } from './passage'
import { usePassageStyle } from './passage-style'
import { scripturePhase, verseSpanFromPassageId } from './reference-passage'
import { lineMultiple } from './styles'
import { chapterRef, footnoteFor, usePassage } from './use-passage'

const EMPTY_SELECTION: ReadonlySet<number> = new Set()
const NO_FOCUS = null

type PassageFont = 'sans' | 'serif'

type PassageEmbedProps = {
  reference: string
  versionId: number
  highlights: Highlight[]
  fontSize: number
  font: PassageFont
  direction?: 'ltr' | 'rtl'
  onFootnotePress?: (data: FootnoteData) => void | Promise<void>
}

export function PassageEmbed({
  reference,
  versionId,
  highlights,
  fontSize,
  font,
  direction,
  onFootnotePress,
}: PassageEmbedProps): ReactNode {
  const { t } = useSdkTranslation()
  const tokens = useTokens()
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
  const address = useMemo(
    () => (enabled && span !== null ? chapterRef(span.book, span.chapter) : null),
    [enabled, span],
  )
  const load = usePassage(fetchBibleContent, versionId, address)
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

  const background = tokens.card
  const { look, paint } = usePassageStyle({
    passage: load.passage,
    highlights,
    fontSize,
    lineMultiple: lineMultiple(READER_LINE_SPACING.DEFAULT),
    fontFamily: font === 'sans' ? INTER_FONT : undefined,
    direction,
    background,
  })

  const onNotePress = useCallback(
    (verse: number | null, html: string) => {
      if (onFootnotePress === undefined) {
        return
      }
      void Promise.resolve(onFootnotePress(footnoteFor(load.passage, verse, html)))
    },
    [load.passage, onFootnotePress],
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
        onNotePress={onNotePress}
      />
    </View>
  )
}

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
