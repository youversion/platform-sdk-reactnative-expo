'use dom'

import type { Highlight } from '@youversion/platform-react-native-expo-core'
import type { BibleVersionPickerPressData, FootnoteData } from '@youversion/platform-react-ui'
import { BibleCard } from '@youversion/platform-react-ui'
import type { ComponentType } from 'react'
import { useEffect } from 'react'

import { applySDKConfig, clearAuthResidue } from '../lib/dom-apply'
import { ContentSizedBody } from '../lib/content-sized-body'
import type { InternalLocaleProps } from '../lib/locale-props'
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
  /**
   * Must be defined on the first render — its presence latches Controlled
   * Highlights Latch. `[]` means nothing highlighted. Omitting it latches
   * self-contained fetch in the WebView; we never omit, because the token
   * stays native.
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

export type BibleCardProps = BibleCardBridgeProps

type BibleCardDOMProps = BibleCardBridgeProps & InternalVersionFilterProps & InternalLocaleProps

export default function BibleCardDOM({
  appKey,
  apiHost,
  installationId,
  highlights,
  theme = 'light',
  onVersionChange,
  onVersionPickerPress,
  onFootnotePress,
  permittedVersionIds,
  excludedVersionIds,
  permittedLanguageTags,
  locale,
  ...props
}: BibleCardDOMProps) {
  applySDKConfig({ appKey, apiHost, installationId })

  // Once per mount, not per render: there is no token to keep in sync any more,
  // only residue an older SDK version left in this WebView's `localStorage`.
  useEffect(() => {
    clearAuthResidue()
  }, [])

  // `highlights` is required, but this is the far side of a serialization
  // boundary, so a bad value arrives as `undefined` with no compile-time trace.
  // Coerce, don't just warn — the warning compiles out in production, and a
  // missing prop latches self-contained fetch in a WebView that has no token.
  const safeHighlights = Array.isArray(highlights) ? highlights : []
  if (process.env.NODE_ENV !== 'production' && !Array.isArray(highlights)) {
    console.error(
      `[YouVersion SDK] BibleCard received a non-array \`highlights\` prop. Omitting this prop latches self-contained fetch in the WebView. Pass \`[]\` for "nothing highlighted".`,
    )
  }

  const NativeActionBibleCard = BibleCard as ComponentType<NativeActionBibleCardProps>

  return (
    <YouVersionProvider
      appKey={appKey}
      theme={theme}
      permittedVersionIds={permittedVersionIds}
      excludedVersionIds={excludedVersionIds}
      permittedLanguageTags={permittedLanguageTags}
      locale={locale}
    >
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
