'use dom'

import { BibleTextView, YouVersionProvider } from '@youversion/platform-react-ui'
import type { StyleProp, ViewStyle } from 'react-native'

type WebBibleTextViewProps = import('@youversion/platform-react-ui').BibleTextViewProps
type WebPassageState = NonNullable<WebBibleTextViewProps['passageState']>

import { type DomError, toWebError } from '../lib/dom-error'

type DomPassageState = Omit<WebPassageState, 'error'> & {
  error?: DomError
}

export type BibleTextViewProps = Omit<
  WebBibleTextViewProps,
  'onVerseSelect' | 'theme' | 'passageState'
> & {
  appKey: string
  theme?: 'light' | 'dark' | 'system'
  // Expo DOM calls cross a runtime boundary (native <-> WebView), so function props are always async “native actions”.
  onVerseSelect?: (verses: number[]) => Promise<void>
  passageState?: DomPassageState
  style?: StyleProp<ViewStyle>
  dom?: import('expo/dom').DOMProps
}

export default function BibleTextViewDOM({
  appKey,
  theme = 'light',
  onVerseSelect,
  passageState,
  ...props
}: BibleTextViewProps) {
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
      />
    </YouVersionProvider>
  )
}

