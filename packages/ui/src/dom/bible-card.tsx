'use dom'

import { BibleCard, YouVersionProvider } from '@youversion/platform-react-ui'
import type { BibleVersionPickerPressData } from '@youversion/platform-react-ui'
import type { ComponentType } from 'react'

type WebBibleCardProps = import('@youversion/platform-react-ui').BibleCardProps
type NativeActionBibleCardProps = WebBibleCardProps & {
  onVersionChange?: (versionId: number) => Promise<void>
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
}

export type BibleCardProps = Omit<WebBibleCardProps, 'onVersionChange' | 'onVersionPickerPress'> & {
  appKey: string
  theme?: 'light' | 'dark'
  onVersionChange?: (versionId: number) => Promise<void>
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  dom?: import('expo/dom').DOMProps
}

export default function BibleCardDOM({
  appKey,
  theme = 'light',
  onVersionChange,
  onVersionPickerPress,
  ...props
}: BibleCardProps) {
  const NativeActionBibleCard = BibleCard as ComponentType<NativeActionBibleCardProps>

  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <NativeActionBibleCard
        {...props}
        onVersionChange={onVersionChange}
        onVersionPickerPress={onVersionPickerPress}
      />
    </YouVersionProvider>
  )
}
