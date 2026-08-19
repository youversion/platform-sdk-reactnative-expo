'use dom'

import { VerseOfTheDay } from '@youversion/platform-react-ui'
import type { VerseOfTheDayProps as WebVerseOfTheDayProps } from '@youversion/platform-react-ui'
import type { DOMProps } from 'expo/dom'
import type { ReactNode } from 'react'
import { applySDKConfig } from '../lib/dom-apply'
import { ContentSizedBody } from '../lib/content-sized-body'
import { YouVersionProvider } from '../lib/web-yv-provider'

export type VerseOfTheDayProps = WebVerseOfTheDayProps & {
  appKey: string
  apiHost: string
  installationId: string
  theme?: 'light' | 'dark' | 'system'
  dom?: DOMProps
}

export default function VerseOfTheDayDOM({
  appKey,
  apiHost,
  installationId,
  theme = 'light',
  onShare,
  ...props
}: VerseOfTheDayProps): ReactNode {
  applySDKConfig({ appKey, apiHost, installationId })

  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <ContentSizedBody />
      <VerseOfTheDay {...props} onShare={onShare} />
    </YouVersionProvider>
  )
}
