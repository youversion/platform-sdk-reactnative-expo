import type {
  FootnoteData,
  VerseOfTheDayProps as WebVerseOfTheDayProps,
} from '@youversion/platform-react-ui'
import { useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, Platform, Pressable, Share, StyleSheet, View } from 'react-native'
import { Button, Card, Text } from '../components/ui'
import { ThemeContext, useTheme, useTokens } from '../hooks'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { DEFAULT_BIBLE_VERSION_ID } from '../lib/constants'
import { getTokens } from '../theme'
import { sansFace } from '../theme/fonts'
import { BibleAppWordmark } from './bible-app-wordmark'
import FootnoteContent from './footnote-content'
import { NativeSheet } from './native-sheet'
import { HighlightsPaint } from './highlights-paint'
import { highlightScopeFor } from './highlight-scope'
import { ShareIcon, VotdIcon } from './icons'
import { PassageEmbed } from './scripture/passage-embed'
import { useVerseOfTheDayPassageId } from './use-verse-of-the-day-passage-id'
import { getDayOfYear } from './verse-of-the-day-api'
import { useVerseOfTheDayShareSource } from './use-verse-of-the-day-share-source'

export type VerseOfTheDayProps = Omit<WebVerseOfTheDayProps, 'highlights'> & {
  theme?: 'light' | 'dark' | 'system'
}

const DEFAULT_FONT_SIZE = 16
const LARGE_FONT_SIZE = 20

async function shareInBrowser(text: string): Promise<void> {
  const { navigator } = globalThis
  if (navigator.share != null) {
    try {
      await navigator.share({ text })
    } catch {
      // User dismissed the share sheet.
    }
    return
  }
  await navigator.clipboard.writeText(text)
}

export function VerseOfTheDay({
  theme,
  background,
  onShare: consumerOnShare,
  versionId = DEFAULT_BIBLE_VERSION_ID,
  dayOfYear: dayOfYearProp,
  showSunIcon = true,
  showShareButton = true,
  showBibleAppAttribution = true,
  size = 'default',
}: VerseOfTheDayProps): ReactNode {
  const { t } = useSdkTranslation()
  const resolvedTheme = useTheme(theme ?? background)
  const [sampledDayOfYear] = useState(() => getDayOfYear(new Date()))
  // Pin the calendar day on native so paint and share cannot resolve "today"
  // on opposite sides of midnight.
  const dayOfYear = dayOfYearProp ?? sampledDayOfYear
  const { passageId, status, retry } = useVerseOfTheDayPassageId(dayOfYear)
  const { shareSource, loadShareSource } = useVerseOfTheDayShareSource(versionId, passageId)
  const scope = highlightScopeFor(passageId, versionId)
  const fontSize = size === 'lg' ? LARGE_FONT_SIZE : DEFAULT_FONT_SIZE
  const [footnoteData, setFootnoteData] = useState<FootnoteData | null>(null)
  useEffect(() => {
    setFootnoteData(null)
  }, [passageId, versionId])

  const handleShare = async () => {
    try {
      // The share request can fail while the verse is already on screen, so a press retries.
      const source = shareSource ?? (await loadShareSource())
      if (source == null) {
        console.warn('VerseOfTheDay share unavailable: passage text could not be loaded')
        return
      }
      if (consumerOnShare != null && Platform.OS !== 'web') {
        await consumerOnShare(source)
        return
      }
      if (Platform.OS === 'web') {
        await shareInBrowser(source.text)
        return
      }
      await Share.share({ message: source.text })
    } catch (error) {
      console.error('VerseOfTheDay share failed:', error)
    }
  }

  return (
    <ThemeContext.Provider value={resolvedTheme}>
      <HighlightsPaint scope={scope}>
        {(highlights) => {
          let body: ReactNode = (
            <View style={styles.loader} accessibilityRole="progressbar">
              <ActivityIndicator
                accessibilityLabel={t('loading')}
                color={getTokens(resolvedTheme).mutedForeground}
                testID="verse-of-the-day-loading"
              />
            </View>
          )
          if (status === 'failed') {
            body = (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('offlineConnectionLostMessage')}
                onPress={retry}
                style={styles.retry}
                testID="verse-of-the-day-retry"
              >
                <Text variant="muted">{t('offlineConnectionLostMessage')}</Text>
              </Pressable>
            )
          } else if (passageId != null) {
            body = (
              <PassageEmbed
                reference={passageId}
                versionId={versionId}
                highlights={highlights}
                fontSize={fontSize}
                font={size === 'lg' ? 'serif' : 'sans'}
                onFootnotePress={
                  Platform.OS === 'web'
                    ? undefined
                    : (data) => {
                        setFootnoteData(data)
                      }
                }
              />
            )
          }

          return (
            <Card testID="verse-of-the-day">
              <VerseOfTheDayHeader
                showSunIcon={showSunIcon}
                showShareButton={showShareButton}
                title={t('verseOfTheDay')}
                reference={shareSource?.reference}
                shareLabel={t('share')}
                shareDisabled={passageId == null}
                onSharePress={() => {
                  void handleShare()
                }}
              />
              <Card.Content>{body}</Card.Content>
              {showBibleAppAttribution ? (
                <Card.Footer style={styles.footer}>
                  <BibleAppWordmark testID="verse-of-the-day-attribution" />
                </Card.Footer>
              ) : null}
            </Card>
          )
        }}
      </HighlightsPaint>
      {footnoteData !== null && Platform.OS !== 'web' ? (
        <NativeSheet
          isOpen
          onClose={() => setFootnoteData(null)}
          theme={resolvedTheme}
          enableContentPanningGesture={false}
        >
          <FootnoteContent data={footnoteData} theme={resolvedTheme} fontSize={fontSize} />
        </NativeSheet>
      ) : null}
    </ThemeContext.Provider>
  )
}

type VerseOfTheDayHeaderProps = {
  showSunIcon: boolean
  showShareButton: boolean
  title: string
  reference: string | undefined
  shareLabel: string
  shareDisabled: boolean
  onSharePress: () => void
}

function VerseOfTheDayHeader({
  showSunIcon,
  showShareButton,
  title,
  reference,
  shareLabel,
  shareDisabled,
  onSharePress,
}: VerseOfTheDayHeaderProps): ReactNode {
  const tokens = useTokens()

  return (
    <Card.Header style={styles.header}>
      {showSunIcon ? (
        <View testID="verse-of-the-day-sun">
          <VotdIcon color={tokens.foreground} />
        </View>
      ) : null}
      <View style={styles.titleBlock}>
        <Text variant="eyebrow">{title}</Text>
        {reference ? (
          <Text
            style={[
              { color: tokens.cardForeground },
              sansFace(tokens.fontFamily.sans, 500),
              tokens.typography.sm,
            ]}
          >
            {reference}
          </Text>
        ) : null}
      </View>
      {showShareButton ? (
        <Button
          variant="ghost"
          size="icon"
          accessibilityLabel={shareLabel}
          disabled={shareDisabled}
          onPress={onSharePress}
          testID="verse-of-the-day-share"
        >
          <Button.Icon as={ShareIcon} />
        </Button>
      ) : null}
    </Card.Header>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleBlock: {
    flex: 1,
    flexShrink: 1,
  },
  loader: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  retry: {
    paddingVertical: 8,
  },
  footer: {
    justifyContent: 'flex-end',
  },
})
