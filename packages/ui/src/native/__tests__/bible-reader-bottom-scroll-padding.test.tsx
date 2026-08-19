import { render } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import {
  IOS_TAB_BAR_CLEARANCE,
  READER_SCROLL_END_GAP,
} from '../../lib/reader-bottom-scroll-padding'
import {
  installBibleReaderTestImpls,
  resetImpls,
} from '../../test-utils/install-test-impls'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleReader } from '../bible-reader'

let latestDomProps: { bottomScrollPadding?: number } = {}

const wrapper = youVersionProviderWrapper()

describe('BibleReader bottom scroll padding', () => {
  beforeEach(() => {
    latestDomProps = {}
    installBibleReaderTestImpls((props) => {
      latestDomProps = props
    })
  })

  afterEach(() => {
    resetImpls()
    jest.restoreAllMocks()
  })

  it('passes computed bottomScrollPadding to the DOM wrapper on iOS', () => {
    const originalOS = Platform.OS
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })

    render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, right: 0, bottom: 34, left: 0 },
        }}
      >
        <BibleReader />
      </SafeAreaProvider>,
      { wrapper },
    )

    expect(latestDomProps.bottomScrollPadding).toBe(
      IOS_TAB_BAR_CLEARANCE + 34 + READER_SCROLL_END_GAP,
    )

    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
  })
})
