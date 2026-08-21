import type { VerseOfTheDayShareData } from '@youversion/platform-react-ui'
import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useState, type ReactNode } from 'react'
import { Platform, Share } from 'react-native'
import type { VerseOfTheDayProps as VerseOfTheDayDOMProps } from '../dom/verse-of-the-day'
import { getImpl } from './component-impls'
import { useTheme } from '../hooks/use-theme'
import { useLocale } from '../i18n/locale-context'
import { DEFAULT_BIBLE_VERSION_ID } from '../lib/constants'
import { withEmbedDomDefaults } from '../lib/embed-dom-props'
import { HighlightsPaint } from './highlights-paint'
import { highlightScopeFor } from './highlight-scope'
import { useVerseOfTheDayPassageId } from './use-verse-of-the-day-passage-id'
import { getDayOfYear } from './verse-of-the-day-api'

export type VerseOfTheDayProps = Omit<
  VerseOfTheDayDOMProps,
  'appKey' | 'apiHost' | 'installationId' | 'highlights'
>

export function VerseOfTheDay({
  theme,
  onShare: consumerOnShare,
  versionId = DEFAULT_BIBLE_VERSION_ID,
  dayOfYear: dayOfYearProp,
  dom,
  ...props
}: VerseOfTheDayProps): ReactNode {
  const context = useYouVersion()
  const { lng } = useLocale()
  const themeContext = useTheme()
  const [sampledDayOfYear] = useState(() => getDayOfYear(new Date()))
  // Pin the calendar day on native and always pass it into the WebView so paint
  // and the card cannot resolve "today" on opposite sides of midnight.
  const dayOfYear = dayOfYearProp ?? sampledDayOfYear
  const passageId = useVerseOfTheDayPassageId(dayOfYear)
  const scope = highlightScopeFor(passageId, versionId)

  const handleShare = async (data: VerseOfTheDayShareData) => {
    try {
      if (consumerOnShare) {
        await consumerOnShare(data)
        return
      }
      await Share.share({ message: data.text })
    } catch (error) {
      console.error('VerseOfTheDay share failed:', error)
    }
  }

  const onShare = Platform.OS !== 'web' ? handleShare : undefined
  const VerseOfTheDayDOM = getImpl('VerseOfTheDayDom')

  return (
    <HighlightsPaint scope={scope}>
      {(highlights) => (
        <VerseOfTheDayDOM
          {...props}
          versionId={versionId}
          dayOfYear={dayOfYear}
          highlights={highlights}
          dom={withEmbedDomDefaults(dom)}
          appKey={context.appKey}
          apiHost={context.apiHost}
          installationId={context.installationId}
          permittedVersionIds={context.permittedVersionIds}
          excludedVersionIds={context.excludedVersionIds}
          permittedLanguageTags={context.permittedLanguageTags}
          locale={lng}
          theme={theme ?? themeContext}
          onShare={onShare}
        />
      )}
    </HighlightsPaint>
  )
}
