'use dom'

import type { BibleVersionPickerPressData, FootnoteData } from '@youversion/platform-react-ui'
import { BibleCard } from '@youversion/platform-react-ui'
import type { ComponentType } from 'react'

import { applySDKConfig, ContentSizedBody } from '../lib'
import { YouVersionProvider } from '../lib/web-yv-provider'

type WebBibleCardProps = import('@youversion/platform-react-ui').BibleCardProps
type NativeActionBibleCardProps = WebBibleCardProps & {
  onVersionChange?: (versionId: number) => Promise<void>
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  onFootnotePress?: (data: FootnoteData) => Promise<void>
}

export type BibleCardProps = Omit<
  WebBibleCardProps,
  'onVersionChange' | 'onVersionPickerPress' | 'onFootnotePress'
> & {
  appKey: string
  onVersionChange?: (versionId: number) => Promise<void>
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  onFootnotePress?: (data: FootnoteData) => Promise<void>
  apiHost: string
  installationId: string
  theme?: 'light' | 'dark'
  dom?: import('expo/dom').DOMProps
}

export default function BibleCardDOM({
  appKey,
  apiHost,
  installationId,
  theme = 'light',
  onVersionChange,
  onVersionPickerPress,
  onFootnotePress,
  ...props
}: BibleCardProps) {
  applySDKConfig({ appKey, apiHost, installationId })
  const NativeActionBibleCard = BibleCard as ComponentType<NativeActionBibleCardProps>

  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <ContentSizedBody />
      <NativeActionBibleCard
        {...props}
        onVersionChange={onVersionChange}
        onVersionPickerPress={onVersionPickerPress}
        onFootnotePress={onFootnotePress}
      />
    </YouVersionProvider>
  )
}
