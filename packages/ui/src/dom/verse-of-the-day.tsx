'use dom'

import { VerseOfTheDay, YouVersionProvider } from '@youversion/platform-react-ui'
import { applySDKConfig } from '../lib'

type WebVerseOfTheDayProps = import('@youversion/platform-react-ui').VerseOfTheDayProps

export type VerseOfTheDayProps = WebVerseOfTheDayProps & {
  appKey: string
  apiHost: string
  installationId: string
  theme?: 'light' | 'dark' | 'system'
  dom?: import('expo/dom').DOMProps
}

export default function VerseOfTheDayDOM({
  appKey,
  apiHost,
  installationId,
  theme = 'light',
  ...props
}: VerseOfTheDayProps) {
  applySDKConfig({ appKey, apiHost, installationId })
  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <VerseOfTheDay {...props} />
    </YouVersionProvider>
  )
}
