import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useState, type ReactNode } from 'react'
import { ActivityIndicator, Platform, Share, StyleSheet, View } from 'react-native'
import { Button, Card, Text } from '../components/ui'
import type { VerseOfTheDayProps as VerseOfTheDayDOMProps } from '../dom/verse-of-the-day'
import { ThemeContext, useTheme, useTokens } from '../hooks'
import { useLocale } from '../i18n/locale-context'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { DEFAULT_BIBLE_VERSION_ID } from '../lib/constants'
import { withEmbedDomDefaults } from '../lib/embed-dom-props'
import { encodeFontFamilyForDom, INTER_FONT, UNTITLED_SERIF_FONT } from '../lib/reader-fonts'
import { getTokens } from '../theme'
import { sansFace } from '../theme/fonts'
import { getImpl } from './component-impls'
import { BibleAppLogo } from './bible-app-logo'
import { HighlightsPaint } from './highlights-paint'
import { highlightScopeFor } from './highlight-scope'
import { ShareIcon, VotdIcon } from './icons'
import { useVerseOfTheDayPassageId } from './use-verse-of-the-day-passage-id'
import { getDayOfYear } from './verse-of-the-day-api'
import { useVerseOfTheDayShareSource } from './use-verse-of-the-day-share-source'

export type VerseOfTheDayProps = Omit<
  VerseOfTheDayDOMProps,
  'appKey' | 'apiHost' | 'installationId' | 'fetchBibleContent' | 'highlights'
>

const DEFAULT_FONT_SIZE = 16
const LARGE_FONT_SIZE = 20

export function VerseOfTheDay({
  theme,
  background,
  onShare: consumerOnShare,
  versionId = DEFAULT_BIBLE_VERSION_ID,
  dayOfYear: dayOfYearProp,
  dom,
  showSunIcon = true,
  showShareButton = true,
  showBibleAppAttribution = true,
  size = 'default',
}: VerseOfTheDayProps): ReactNode {
  const context = useYouVersion()
  const { lng } = useLocale()
  const { t } = useSdkTranslation()
  const resolvedTheme = useTheme(theme ?? background)
  const [sampledDayOfYear] = useState(() => getDayOfYear(new Date()))
  // Pin the calendar day on native so paint and share cannot resolve "today"
  // on opposite sides of midnight.
  const dayOfYear = dayOfYearProp ?? sampledDayOfYear
  const passageId = useVerseOfTheDayPassageId(dayOfYear)
  const { shareSource, loadShareSource } = useVerseOfTheDayShareSource(versionId, passageId)
  const scope = highlightScopeFor(passageId, versionId)
  const fontFamily = size === 'lg' ? UNTITLED_SERIF_FONT : INTER_FONT
  const fontSize = size === 'lg' ? LARGE_FONT_SIZE : DEFAULT_FONT_SIZE

  const handleShare = async () => {
    try {
      // The background fetch can fail while the DOM view still paints the
      // verse, so a press retries instead of staying dead for the mount.
      const source = shareSource ?? (await loadShareSource())
      if (source == null) {
        console.warn('VerseOfTheDay share unavailable: passage text could not be loaded')
        return
      }
      if (consumerOnShare) {
        await consumerOnShare(source)
        return
      }
      if (Platform.OS === 'web') {
        return
      }
      await Share.share({ message: source.text })
    } catch (error) {
      console.error('VerseOfTheDay share failed:', error)
    }
  }

  const BibleTextViewDOM = getImpl('BibleTextViewDom')

  return (
    <ThemeContext.Provider value={resolvedTheme}>
      <HighlightsPaint scope={scope}>
        {(highlights) => (
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
            <Card.Content>
              {passageId == null ? (
                <View style={styles.loader} accessibilityRole="progressbar">
                  <ActivityIndicator
                    accessibilityLabel={t('loading')}
                    color={getTokens(resolvedTheme).mutedForeground}
                    testID="verse-of-the-day-loading"
                  />
                </View>
              ) : (
                <BibleTextViewDOM
                  reference={passageId}
                  versionId={versionId}
                  showVerseNumbers={false}
                  fontSize={fontSize}
                  fontFamily={encodeFontFamilyForDom(fontFamily)}
                  highlights={highlights}
                  appKey={context.appKey}
                  apiHost={context.apiHost}
                  installationId={context.installationId}
                  fetchBibleContent={context.fetchBibleContent}
                  permittedVersionIds={context.permittedVersionIds}
                  excludedVersionIds={context.excludedVersionIds}
                  permittedLanguageTags={context.permittedLanguageTags}
                  locale={lng}
                  theme={resolvedTheme}
                  dom={withEmbedDomDefaults(dom)}
                />
              )}
            </Card.Content>
            {showBibleAppAttribution ? (
              <Card.Footer style={styles.footer}>
                <View
                  accessibilityRole="image"
                  accessibilityLabel={t('bibleApp')}
                  style={styles.attribution}
                  testID="verse-of-the-day-attribution"
                >
                  <BibleAppLogo size={24} />
                  <Text variant="muted">{t('bibleApp')}</Text>
                </View>
              </Card.Footer>
            ) : null}
          </Card>
        )}
      </HighlightsPaint>
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
  footer: {
    justifyContent: 'flex-end',
  },
  attribution: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
})
