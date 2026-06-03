'use dom'

import type { VerseOfTheDayShareData } from '@youversion/platform-react-ui'
import { VerseOfTheDay } from '@youversion/platform-react-ui'
import type { ComponentType } from 'react'
import { applySDKConfig } from '../lib'
import { YouVersionProvider } from '../lib/web-yv-provider'

type WebVerseOfTheDayProps = import('@youversion/platform-react-ui').VerseOfTheDayProps
type NativeActionVerseOfTheDayProps = WebVerseOfTheDayProps & {
  onShare?: (data: VerseOfTheDayShareData) => Promise<void>
}

export type VerseOfTheDayProps = Omit<WebVerseOfTheDayProps, 'onShare'> & {
  appKey: string
  apiHost: string
  installationId: string
  theme?: 'light' | 'dark' | 'system'
  onShare?: (data: VerseOfTheDayShareData) => Promise<void>
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
  const NativeActionVerseOfTheDay = VerseOfTheDay as ComponentType<NativeActionVerseOfTheDayProps>

  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <NativeActionVerseOfTheDay {...props} onShare={onShare} />
    </YouVersionProvider>
  )
}
