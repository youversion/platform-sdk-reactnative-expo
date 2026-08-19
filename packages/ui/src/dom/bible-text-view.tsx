'use dom'

import type { Highlight } from '@youversion/platform-react-native-expo-core'
import type { FootnoteData } from '@youversion/platform-react-ui'
import { BibleTextView } from '@youversion/platform-react-ui'
import { useEffect } from 'react'

import { applySDKConfig, clearAuthResidue } from '../lib/dom-apply'
import { toWebError, type DomError } from '../lib/dom-error'
import { YouVersionProvider } from '../lib/web-yv-provider'

type WebBibleTextViewProps = import('@youversion/platform-react-ui').BibleTextViewProps
type WebPassageState = NonNullable<WebBibleTextViewProps['passageState']>

type DomPassageState = Omit<WebPassageState, 'error'> & {
  error?: DomError
}

export type BibleTextViewProps = Omit<
  WebBibleTextViewProps,
  'onVerseSelect' | 'onFootnotePress' | 'theme' | 'passageState'
> & {
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
  // Expo DOM calls cross a runtime boundary (native <-> WebView), so function props are always async “native actions”.
  onVerseSelect?: (verses: number[]) => Promise<void>
  // Expo DOM calls cross a runtime boundary (native <-> WebView), so function props are always async “native actions”.
  onFootnotePress?: (data: FootnoteData) => Promise<void>
  passageState?: DomPassageState
  dom?: import('expo/dom').DOMProps
}

export default function BibleTextViewDOM({
  appKey,
  apiHost,
  installationId,
  highlights,
  theme = 'light',
  onVerseSelect,
  onFootnotePress,
  passageState,
  ...props
}: BibleTextViewProps) {
  applySDKConfig({ apiHost, appKey, installationId })

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
      `[YouVersion SDK] BibleTextView received a non-array \`highlights\` prop. Omitting this prop latches self-contained fetch in the WebView. Pass \`[]\` for "nothing highlighted".`,
    )
  }

  const webPassageState: WebBibleTextViewProps['passageState'] =
    passageState != null
      ? {
          ...passageState,
          error: toWebError(passageState.error),
        }
      : undefined

  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <BibleTextView
        {...props}
        highlights={safeHighlights}
        passageState={webPassageState}
        onVerseSelect={onVerseSelect}
        onFootnotePress={onFootnotePress}
      />
    </YouVersionProvider>
  )
}
