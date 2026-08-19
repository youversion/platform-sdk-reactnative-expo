'use dom'

import type { Highlight } from '@youversion/platform-react-native-expo-core'
import { VerseOfTheDay } from '@youversion/platform-react-ui'
import type { VerseOfTheDayProps as WebVerseOfTheDayProps } from '@youversion/platform-react-ui'
import { useEffect } from 'react'

import { applySDKConfig, clearAuthResidue } from '../lib/dom-apply'
import { ContentSizedBody } from '../lib/content-sized-body'
import { YouVersionProvider } from '../lib/web-yv-provider'

export type VerseOfTheDayProps = WebVerseOfTheDayProps & {
  appKey: string
  apiHost: string
  installationId: string
  /**
   * Must be defined on the first render — its presence latches Controlled
   * Highlights Latch. `[]` means nothing highlighted. Omitting it latches
   * self-contained fetch in the WebView; we never omit, because the token
   * stays native.
   */
  highlights: Highlight[]
  theme?: 'light' | 'dark' | 'system'
  dom?: import('expo/dom').DOMProps
}

export default function VerseOfTheDayDOM({
  appKey,
  apiHost,
  installationId,
  highlights,
  theme = 'light',
  onShare,
  ...props
}: VerseOfTheDayProps) {
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
      `[YouVersion SDK] VerseOfTheDay received a non-array \`highlights\` prop. Omitting this prop latches self-contained fetch in the WebView. Pass \`[]\` for "nothing highlighted".`,
    )
  }

  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <ContentSizedBody />
      <VerseOfTheDay {...props} highlights={safeHighlights} onShare={onShare} />
    </YouVersionProvider>
  )
}
