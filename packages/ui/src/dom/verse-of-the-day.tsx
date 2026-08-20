'use dom'

import { VerseOfTheDay } from '@youversion/platform-react-ui'
import type { VerseOfTheDayProps as WebVerseOfTheDayProps } from '@youversion/platform-react-ui'
import { applySDKConfig } from '../lib/dom-apply'
import { ContentSizedBody } from '../lib/content-sized-body'
import { YouVersionProvider } from '../lib/web-yv-provider'

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
  onShare,
  ...props
}: VerseOfTheDayProps) {
  applySDKConfig({ appKey, apiHost, installationId })

  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <ContentSizedBody />
      <VerseOfTheDay {...props} onShare={onShare} />
    </YouVersionProvider>
  )
}
