import { Text, View } from 'react-native'

import { resetImpls, setImpl, type ImplComponent, type ImplKey } from '../native/component-impls'

export { resetImpls, setImpl }

export function captureDom<P extends object>(
  key: ImplKey,
  assign: (props: P) => void,
  testID = `mock-${key}`,
): void {
  const Capture: ImplComponent = (props) => {
    // SAFETY: registered for one key; tests type P as that component's props.
    assign(props as P)
    return (
      <View testID={testID}>
        <Text>{key}</Text>
      </View>
    )
  }
  setImpl(key, Capture)
}

export function stubImpl(key: ImplKey, testID = `mock-${key}`): void {
  const Stub: ImplComponent = () => <View testID={testID} />
  setImpl(key, Stub)
}

/** Sibling sheets + unused DOM so BibleReader tests do not mount `'use dom'`. */
export function installBibleReaderTestImpls<P extends object>(
  assignReaderProps?: (props: P) => void,
): void {
  stubImpl('FootnoteContent', 'mock-footnote')
  stubImpl('BibleChapterPickerSheet', 'mock-chapter-picker-sheet')
  stubImpl('BibleVersionPickerSheet', 'mock-version-picker-sheet')
  stubImpl('BibleReaderSettingsSheet', 'mock-settings-sheet')
  stubImpl('NativeSheet')
  stubImpl('SignInWithYouVersionSheet', 'mock-sign-in-sheet')
  stubImpl('HighlightConsentSheet', 'mock-consent-sheet')
  if (assignReaderProps) {
    captureDom('BibleReaderDom', assignReaderProps, 'mock-dom')
  } else {
    stubImpl('BibleReaderDom', 'mock-dom')
  }
}
