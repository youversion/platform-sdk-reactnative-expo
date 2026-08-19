import { Text, View } from 'react-native'

import {
  resetImpls,
  setImpls,
  type ImplComponent,
  type ImplKey,
} from '../native/component-impls'

export { resetImpls, setImpls }

export function captureDom(
  key: ImplKey,
  assign: (props: Record<string, unknown>) => void,
  testID = `mock-${key}`,
): void {
  const Capture: ImplComponent = (props) => {
    assign(props)
    return (
      <View testID={testID}>
        <Text>{key}</Text>
      </View>
    )
  }
  setImpls({ [key]: Capture })
}

export function stubImpl(key: ImplKey, testID = `mock-${key}`): void {
  const Stub: ImplComponent = () => <View testID={testID} />
  setImpls({ [key]: Stub })
}

/** Sibling sheets + unused DOM so BibleReader tests do not mount `'use dom'`. */
export function installBibleReaderTestImpls(
  assignReaderProps?: (props: Record<string, unknown>) => void,
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
