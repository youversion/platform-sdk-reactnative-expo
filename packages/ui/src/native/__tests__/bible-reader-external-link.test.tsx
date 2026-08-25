import { act, fireEvent, render } from '@testing-library/react-native'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import * as WebBrowser from 'expo-web-browser'
import type { WebBrowserResult } from 'expo-web-browser'
import { Pressable, Text, View } from 'react-native'

import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import {
  installBibleReaderTestImpls,
  resetImpls,
  setImpl,
} from '../../test-utils/install-test-impls'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleReader } from '../bible-reader'

type LatestDomProps = {
  onExternalLinkPress?: (url: string) => Promise<void>
}

let latestDomProps: LatestDomProps = {}

function MockDOM(props: LatestDomProps) {
  latestDomProps = props
  return (
    <View testID="mock-dom">
      <Pressable
        testID="trigger-external-link"
        onPress={() => props.onExternalLinkPress?.('https://www.bible.com/versions/1')}
      >
        <Text>Learn More</Text>
      </Pressable>
    </View>
  )
}

const wrapper = youVersionProviderWrapper()

function dismissedBrowser(): WebBrowserResult {
  const result = { type: 'dismiss' }
  // SAFETY: expo-web-browser types `type` as a string enum, not the `'dismiss'` literal.
  return result as WebBrowserResult
}

describe('BibleReader external link handling', () => {
  beforeEach(async () => {
    latestDomProps = {}
    installBibleReaderTestImpls()
    setImpl('BibleReaderDom', MockDOM)
    jest.spyOn(WebBrowser, 'openBrowserAsync').mockResolvedValue(dismissedBrowser())
    mmkvStorage.clearAll()
    useReaderLocationStore.setState(readerLocationStoreInitialState)
    await useReaderLocationStore.persist.rehydrate()
  })

  afterEach(() => {
    resetImpls()
    jest.restoreAllMocks()
  })

  it('passes onExternalLinkPress across the bridge', () => {
    render(<BibleReader />, { wrapper })
    expect(latestDomProps.onExternalLinkPress).toEqual(expect.any(Function))
  })

  it('opens an outbound URL in the system browser', async () => {
    const { getByTestId } = render(<BibleReader />, { wrapper })

    await act(async () => {
      fireEvent.press(getByTestId('trigger-external-link'))
    })

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'https://www.bible.com/versions/1',
      expect.objectContaining({ dismissButtonStyle: 'close' }),
    )
  })
})
