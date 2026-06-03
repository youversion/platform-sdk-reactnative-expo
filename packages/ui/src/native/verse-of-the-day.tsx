import type { VerseOfTheDayShareData } from '@youversion/platform-react-ui'
import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useCallback } from 'react'
import { Platform, Share } from 'react-native'
import type { VerseOfTheDayProps as VerseOfTheDayDOMProps } from '../dom/verse-of-the-day'
import VerseOfTheDayDOM from '../dom/verse-of-the-day'
import { useTheme } from './youversion-provider'

export type VerseOfTheDayProps = Omit<
  VerseOfTheDayDOMProps,
  'appKey' | 'apiHost' | 'installationId'
>

export function VerseOfTheDay({
  theme,
  onShare: consumerOnShare,
  ...props
}: VerseOfTheDayProps) {
  const context = useYouVersion()
  const themeContext = useTheme()

  const handleShare = useCallback(
    async (data: VerseOfTheDayShareData) => {
      if (consumerOnShare) {
        await consumerOnShare(data)
        return
      }
      await Share.share({ message: data.text })
    },
    [consumerOnShare],
  )

  const onShare = Platform.OS !== 'web' ? handleShare : undefined

  return (
    <VerseOfTheDayDOM
      {...props}
      appKey={context.appKey}
      apiHost={context.apiHost}
      installationId={context.installationId}
      theme={theme ?? themeContext}
      onShare={onShare}
    />
  )
}
