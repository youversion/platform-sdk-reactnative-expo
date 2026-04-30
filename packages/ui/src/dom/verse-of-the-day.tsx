'use dom'

import { VerseOfTheDay, YouVersionProvider } from '@youversion/platform-react-ui'

type WebVerseOfTheDayProps = import('@youversion/platform-react-ui').VerseOfTheDayProps

export type VerseOfTheDayProps = WebVerseOfTheDayProps & {
  appKey: string
  theme?: 'light' | 'dark' | 'system'
  dom?: import('expo/dom').DOMProps
}

export default function VerseOfTheDayDOM({
  appKey,
  theme = 'light',
  ...props
}: VerseOfTheDayProps) {
  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <VerseOfTheDay {...props} />
    </YouVersionProvider>
  )
}
