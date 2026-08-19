'use dom'

import {
  BibleCard,
  type BibleCardProps as WebBibleCardProps,
  type BibleVersionPickerPressData,
  type FootnoteData,
} from '@youversion/platform-react-ui'
import type { DOMProps } from 'expo/dom'
import type { ComponentType, ReactNode } from 'react'

import { applySDKConfig } from '../lib/dom-apply'
import { ContentSizedBody } from '../lib/content-sized-body'
import { YouVersionProvider } from '../lib/web-yv-provider'

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
  dom?: DOMProps
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
}: BibleCardProps): ReactNode {
  applySDKConfig({ appKey, apiHost, installationId })
  // SAFETY: Expo DOM native actions are Promise-returning; Web SDK types them as void.
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
