'use dom'

import { VerseOfTheDay } from '@youversion/platform-react-ui'

import { YouVersionProvider } from '../lib/web-yv-provider'

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
