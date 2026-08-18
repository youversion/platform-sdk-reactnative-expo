import type { VerseOfTheDayShareData } from '@youversion/platform-react-ui'
import {
  parseChapterScopeFromUsfm,
  useVerseOfTheDayPassageId,
  useYouVersion,
  type HighlightScope,
} from '@youversion/platform-react-native-expo-core'
import { useCallback } from 'react'
import { Platform, Share } from 'react-native'
import type { VerseOfTheDayProps as VerseOfTheDayDOMProps } from '../dom/verse-of-the-day'
import VerseOfTheDayDOM from '../dom/verse-of-the-day'
import { useTheme } from '../hooks/use-theme'
import { DEFAULT_BIBLE_VERSION_ID } from '../lib/constants'
import { withEmbedDomDefaults } from '../lib/embed-dom-props'
import { HighlightsPaint } from './highlights-paint'

export type VerseOfTheDayProps = Omit<
  VerseOfTheDayDOMProps,
  'appKey' | 'apiHost' | 'installationId' | 'highlights'
>

function highlightScopeFor(passageId: string | null, versionId: number): HighlightScope | null {
  if (passageId === null) {
    return null
  }
  const parsed = parseChapterScopeFromUsfm(passageId)
  if (parsed === null) {
    return null
  }
  return { versionId, book: parsed.book, chapter: parsed.chapter }
}

export function VerseOfTheDay({
  theme,
  onShare: consumerOnShare,
  versionId = DEFAULT_BIBLE_VERSION_ID,
  dom,
  ...props
}: VerseOfTheDayProps) {
  const context = useYouVersion()
  const themeContext = useTheme()
  const passageId = useVerseOfTheDayPassageId()
  const scope = highlightScopeFor(passageId, versionId)

  const handleShare = useCallback(
    async (data: VerseOfTheDayShareData) => {
      try {
        if (consumerOnShare) {
          await consumerOnShare(data)
          return
        }
        await Share.share({ message: data.text })
      } catch (error) {
        console.error('VerseOfTheDay share failed:', error)
      }
    },
    [consumerOnShare],
  )

  const onShare = Platform.OS !== 'web' ? handleShare : undefined

  return (
    <HighlightsPaint scope={scope}>
      {(highlights) => (
        <VerseOfTheDayDOM
          {...props}
          versionId={versionId}
          highlights={highlights}
          dom={withEmbedDomDefaults(dom)}
          appKey={context.appKey}
          apiHost={context.apiHost}
          installationId={context.installationId}
          theme={theme ?? themeContext}
          onShare={onShare}
        />
      )}
    </HighlightsPaint>
  )
}
