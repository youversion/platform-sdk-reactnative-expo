'use dom'

import { BibleCard } from '@youversion/platform-react-ui'
import type { BibleVersionPickerPressData, FootnoteData } from '@youversion/platform-react-ui'
import type { ComponentType } from 'react'

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
  theme?: 'light' | 'dark'
  onVersionChange?: (versionId: number) => Promise<void>
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  onFootnotePress?: (data: FootnoteData) => Promise<void>
  dom?: import('expo/dom').DOMProps
}

export default function BibleCardDOM({
  appKey,
  theme = 'light',
  onVersionChange,
  onVersionPickerPress,
  onFootnotePress,
  ...props
}: BibleCardProps) {
  const NativeActionBibleCard = BibleCard as ComponentType<NativeActionBibleCardProps>

  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <NativeActionBibleCard
        {...props}
        onVersionChange={onVersionChange}
        onVersionPickerPress={onVersionPickerPress}
        onFootnotePress={onFootnotePress}
      />
    </YouVersionProvider>
  )
}
