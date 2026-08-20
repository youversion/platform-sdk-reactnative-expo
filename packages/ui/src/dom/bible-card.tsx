'use dom'

import type { BibleVersionPickerPressData, FootnoteData } from '@youversion/platform-react-ui'
import { BibleCard } from '@youversion/platform-react-ui'
import type { ComponentType } from 'react'

import { applySDKConfig } from '../lib/dom-apply'
import { ContentSizedBody } from '../lib/content-sized-body'
import type { InternalVersionFilterProps } from '../lib/version-filter-props'
import { YouVersionProvider } from '../lib/web-yv-provider'

type WebBibleCardProps = import('@youversion/platform-react-ui').BibleCardProps
type NativeActionBibleCardProps = WebBibleCardProps & {
  onVersionChange?: (versionId: number) => Promise<void>
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  onFootnotePress?: (data: FootnoteData) => Promise<void>
}

type BibleCardBridgeProps = Omit<
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

export type BibleCardProps = BibleCardBridgeProps

type BibleCardDOMProps = BibleCardBridgeProps & InternalVersionFilterProps

export default function BibleCardDOM({
  appKey,
  apiHost,
  installationId,
  theme = 'light',
  onVersionChange,
  onVersionPickerPress,
  onFootnotePress,
  permittedVersionIds,
  excludedVersionIds,
  permittedLanguageTags,
  ...props
}: BibleCardDOMProps) {
  applySDKConfig({ appKey, apiHost, installationId })
  const NativeActionBibleCard = BibleCard as ComponentType<NativeActionBibleCardProps>

  return (
    <YouVersionProvider
      appKey={appKey}
      theme={theme}
      permittedVersionIds={permittedVersionIds}
      excludedVersionIds={excludedVersionIds}
      permittedLanguageTags={permittedLanguageTags}
    >
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
