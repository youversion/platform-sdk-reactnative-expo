'use dom'

import type { FootnoteData } from '@youversion/platform-react-ui'
import { BibleTextView, YouVersionProvider } from '@youversion/platform-react-ui'

import { applySDKConfig } from '../lib'
import { toWebError, type DomError } from '../lib/dom-error'

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
  theme = 'light',
  onVerseSelect,
  onFootnotePress,
  passageState,
  ...props
}: BibleTextViewProps) {
  applySDKConfig({ apiHost, appKey, installationId })
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
        passageState={webPassageState}
        onVerseSelect={onVerseSelect}
        onFootnotePress={onFootnotePress}
      />
    </YouVersionProvider>
  )
}
