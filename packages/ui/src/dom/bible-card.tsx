'use dom'

import type { Highlight } from '@youversion/platform-react-native-expo-core'
import type { BibleVersionPickerPressData, FootnoteData } from '@youversion/platform-react-ui'
import { BibleCard } from '@youversion/platform-react-ui'
import type { ComponentType } from 'react'
import { useEffect } from 'react'

import { applySDKConfig, clearAuthResidue } from '../lib/dom-apply'
import { ContentSizedBody } from '../lib/content-sized-body'
import { YouVersionProvider } from '../lib/web-yv-provider'

type WebBibleCardProps = import('@youversion/platform-react-ui').BibleCardProps
type NativeActionBibleCardProps = WebBibleCardProps & {
  onVersionChange?: (versionId: number) => Promise<void>
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  onFootnotePress?: (data: FootnoteData) => Promise<void>
  // TODO(YPE): drop after platform-sdk-react#335 pin
  highlights: Highlight[]
}

export type BibleCardProps = Omit<
  WebBibleCardProps,
  'onVersionChange' | 'onVersionPickerPress' | 'onFootnotePress'
> & {
  appKey: string
  /**
   * Must be defined on the first render — its presence latches the reader into
   * controlled mode, and omitting it lets the WebView fetch and write highlights
   * with the token we hand it. Pass `[]` for "nothing highlighted".
   */
  highlights: Highlight[]
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
  highlights,
  theme = 'light',
  onVersionChange,
  onVersionPickerPress,
  onFootnotePress,
  ...props
}: BibleCardProps) {
  applySDKConfig({ appKey, apiHost, installationId })

  // Once per mount, not per render: there is no token to keep in sync any more,
  // only residue an older SDK version left in this WebView's `localStorage`.
  useEffect(() => {
    clearAuthResidue()
  }, [])

  // `highlights` is required, but this is the far side of a serialization
  // boundary, so a bad value arrives as `undefined` with no compile-time trace.
  // Coerce, don't just warn — the warning compiles out in production, and a
  // missing prop hands the WebView back the ability to write highlights.
  const safeHighlights = Array.isArray(highlights) ? highlights : []
  if (process.env.NODE_ENV !== 'production' && !Array.isArray(highlights)) {
    console.error(
      `[YouVersion SDK] BibleCard received a non-array \`highlights\` prop. The reader falls back to self-contained mode when this prop is missing, which lets the WebView write highlights itself. Pass \`[]\` for "nothing highlighted".`,
    )
  }

  // TODO(YPE): drop after platform-sdk-react#335 pin
  const NativeActionBibleCard = BibleCard as ComponentType<NativeActionBibleCardProps>

  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <ContentSizedBody />
      <NativeActionBibleCard
        {...props}
        highlights={safeHighlights}
        onVersionChange={onVersionChange}
        onVersionPickerPress={onVersionPickerPress}
        onFootnotePress={onFootnotePress}
      />
    </YouVersionProvider>
  )
}
