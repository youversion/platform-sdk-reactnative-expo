import { act, fireEvent, render } from '@testing-library/react-native'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import * as WebBrowser from 'expo-web-browser'
import { Pressable, Text, View } from 'react-native'

import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import {
  installBibleReaderTestImpls,
  resetImpls,
  setImpls,
} from '../../test-utils/install-test-impls'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleReader } from '../bible-reader'

let latestDomProps: { onExternalLinkPress?: (url: string) => Promise<void> } = {}

function MockDOM(props: { onExternalLinkPress?: (url: string) => Promise<void> }) {
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

describe('BibleReader external link handling', () => {
  beforeEach(async () => {
    latestDomProps = {}
    installBibleReaderTestImpls()
    setImpls({ BibleReaderDom: MockDOM })
    jest.spyOn(WebBrowser, 'openBrowserAsync').mockResolvedValue({ type: 'dismiss' })
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
    expect(typeof latestDomProps.onExternalLinkPress).toBe('function')
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
