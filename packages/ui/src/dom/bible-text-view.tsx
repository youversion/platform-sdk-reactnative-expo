'use dom'

import type { Highlight } from '@youversion/platform-react-native-expo-core'
import type { FootnoteData } from '@youversion/platform-react-ui'
import { BibleTextView } from '@youversion/platform-react-ui'
import type { ComponentType } from 'react'
import { useEffect } from 'react'

import { applySDKConfig, clearAuthResidue } from '../lib/dom-apply'
import { toWebError, type DomError } from '../lib/dom-error'
import { YouVersionProvider } from '../lib/web-yv-provider'

type WebBibleTextViewProps = import('@youversion/platform-react-ui').BibleTextViewProps
type WebPassageState = NonNullable<WebBibleTextViewProps['passageState']>

type DomPassageState = Omit<WebPassageState, 'error'> & {
  error?: DomError
}

// TODO(YPE): drop after platform-sdk-react#335 pin
type NativeActionBibleTextViewProps = WebBibleTextViewProps & {
  highlights: Highlight[]
}

export type BibleTextViewProps = Omit<
  WebBibleTextViewProps,
  'onVerseSelect' | 'onFootnotePress' | 'theme' | 'passageState'
> & {
  appKey: string
  apiHost: string
  installationId: string
  /**
   * Must be defined on the first render — its presence latches the reader into
   * controlled mode, and omitting it lets the WebView fetch and write highlights
   * with the token we hand it. Pass `[]` for "nothing highlighted".
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
  // missing prop hands the WebView back the ability to write highlights.
  const safeHighlights = Array.isArray(highlights) ? highlights : []
  if (process.env.NODE_ENV !== 'production' && !Array.isArray(highlights)) {
    console.error(
      `[YouVersion SDK] BibleTextView received a non-array \`highlights\` prop. The reader falls back to self-contained mode when this prop is missing, which lets the WebView write highlights itself. Pass \`[]\` for "nothing highlighted".`,
    )
  }

  const webPassageState: WebBibleTextViewProps['passageState'] =
    passageState != null
      ? {
          ...passageState,
          error: toWebError(passageState.error),
        }
      : undefined

  // TODO(YPE): drop after platform-sdk-react#335 pin
  const NativeActionBibleTextView = BibleTextView as ComponentType<NativeActionBibleTextViewProps>

  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <NativeActionBibleTextView
        {...props}
        highlights={safeHighlights}
        passageState={webPassageState}
        onVerseSelect={onVerseSelect}
        onFootnotePress={onFootnotePress}
      />
    </YouVersionProvider>
  )
}
