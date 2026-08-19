'use dom'

import {
  BibleTextView,
  type BibleTextViewProps as WebBibleTextViewProps,
  type FootnoteData,
} from '@youversion/platform-react-ui'
import type { DOMProps } from 'expo/dom'
import type { ReactNode } from 'react'

import { applySDKConfig } from '../lib/dom-apply'
import { toWebError, type DomError } from '../lib/dom-error'
import { YouVersionProvider } from '../lib/web-yv-provider'

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
  dom?: DOMProps
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
}: BibleTextViewProps): ReactNode {
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
        onVerseSelect={
          onVerseSelect
            ? (verses) => {
                void onVerseSelect(verses)
              }
            : undefined
        }
        onFootnotePress={
          onFootnotePress
            ? (data) => {
                void onFootnotePress(data)
              }
            : undefined
        }
      />
    </YouVersionProvider>
  )
}
