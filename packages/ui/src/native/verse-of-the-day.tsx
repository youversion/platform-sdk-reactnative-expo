import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import type { VerseOfTheDayProps as VerseOfTheDayDOMProps } from '../dom/verse-of-the-day'
import VerseOfTheDayDOM from '../dom/verse-of-the-day'
import { useTheme } from './youversion-provider'

export type VerseOfTheDayProps = Omit<
  VerseOfTheDayDOMProps,
  'appKey' | 'apiHost' | 'installationId'
>

export function VerseOfTheDay({ theme, ...props }: VerseOfTheDayProps) {
  const context = useYouVersion()
  const themeContext = useTheme()

  return (
    <VerseOfTheDayDOM
      {...props}
      appKey={context.appKey}
      apiHost={context.apiHost}
      installationId={context.installationId}
      theme={theme ?? themeContext}
    />
  )
}
