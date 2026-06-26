import { act, fireEvent, render } from '@testing-library/react-native'
import type { VerseOfTheDayShareData } from '@youversion/platform-react-ui'
import * as ReactNative from 'react-native'
import { Platform, Share } from 'react-native'

import { youVersionProviderWrapper as wrapper } from '../../test-utils/youversion-provider-wrapper'
import { VerseOfTheDay } from '../verse-of-the-day'

const sampleShareData: VerseOfTheDayShareData = {
  text: 'For God so loved the world...\n\nJohn 3:16 NIV',
  reference: 'John 3:16 NIV',
  verseText: 'For God so loved the world...',
}

let latestDomProps: {
  appKey?: string
  versionId?: number
  theme?: string
  dom?: { matchContents?: boolean; containerStyle?: unknown }
  onShare?: (data: VerseOfTheDayShareData) => Promise<void>
} = {}

jest.mock('../../dom/verse-of-the-day', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text: RNText, View: RNView } = require('react-native')
  return {
    __esModule: true,
    default: function MockVerseOfTheDayDOM(props: {
      appKey: string
      versionId?: number
      theme?: string
      dom?: { matchContents?: boolean }
      onShare?: (data: VerseOfTheDayShareData) => Promise<void>
    }) {
      latestDomProps = props
      return (
        <RNView testID="mock-votd-dom">
          <RNText testID="mock-app-key">{props.appKey}</RNText>
          <RNText testID="mock-version-id">{String(props.versionId ?? '')}</RNText>
          <RNText testID="mock-theme">{props.theme ?? ''}</RNText>
          <RNText testID="mock-dom-match-contents">
            {props.dom?.matchContents === true ? '1' : '0'}
          </RNText>
          <RNText testID="mock-has-share-handler">{props.onShare ? 'yes' : 'no'}</RNText>
          <Pressable
            testID="mock-share-trigger"
            onPress={() => {
              void props.onShare?.(sampleShareData)
            }}
          >
            <RNText>share</RNText>
          </Pressable>
        </RNView>
      )
    },
  }
})

describe('VerseOfTheDay', () => {
  const originalOs = Platform.OS

  beforeEach(() => {
    latestDomProps = {}
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: originalOs,
    })
  })

  it('forwards appKey from YouVersionProvider and consumer props to the DOM entry', () => {
    const { getByTestId } = render(
      <VerseOfTheDay versionId={3034} dom={{ matchContents: true }} />,
      { wrapper: wrapper() },
    )

    expect(getByTestId('mock-app-key').children).toContain('test-key')
    expect(getByTestId('mock-version-id').children).toContain('3034')
    expect(getByTestId('mock-dom-match-contents').children).toContain('1')
  })

  it('applies the embed dom defaults when no dom prop is passed', () => {
    render(<VerseOfTheDay versionId={3034} />, { wrapper: wrapper() })

    expect(latestDomProps.dom).toEqual({
      matchContents: true,
      containerStyle: { flex: 0, width: '100%' },
      scrollEnabled: false,
      bounces: false,
      overScrollMode: 'never',
    })
  })

  it('merges a consumer containerStyle after the embed defaults', () => {
    render(<VerseOfTheDay versionId={3034} dom={{ containerStyle: { width: 300 } }} />, {
      wrapper: wrapper(),
    })

    expect(latestDomProps.dom?.containerStyle).toEqual([{ flex: 0, width: '100%' }, { width: 300 }])
  })

  it('forwards a component-level theme override to the DOM entry', () => {
    const { getByTestId } = render(<VerseOfTheDay versionId={3034} theme="dark" />, {
      wrapper: wrapper('light'),
    })

    expect(getByTestId('mock-theme').children).toContain('dark')
  })

  it('forwards theme="system" from VerseOfTheDay props to the DOM entry', () => {
    const { getByTestId } = render(<VerseOfTheDay versionId={3034} theme="system" />, {
      wrapper: wrapper('light'),
    })

    expect(getByTestId('mock-theme').children).toContain('system')
  })

  it('uses the provider-resolved theme when VerseOfTheDay does not set theme', () => {
    const { getByTestId } = render(<VerseOfTheDay versionId={3034} />, {
      wrapper: wrapper('dark'),
    })

    expect(getByTestId('mock-theme').children).toContain('dark')
  })

  it('uses provider-resolved theme when provider theme is system and color scheme is dark', () => {
    const spy = jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark')

    const { getByTestId } = render(<VerseOfTheDay versionId={3034} />, {
      wrapper: wrapper('system'),
    })

    try {
      expect(getByTestId('mock-theme').children).toContain('dark')
    } finally {
      spy.mockRestore()
    }
  })

  it('throws when YouVersionProvider is missing', () => {
    expect(() => render(<VerseOfTheDay versionId={3034} />)).toThrow(
      'YouVersionProvider is required. Wrap your app with <YouVersionProvider appKey="...">.',
    )
  })

  it('wires onShare to the DOM entry on native platforms', () => {
    render(<VerseOfTheDay versionId={3034} />, { wrapper: wrapper() })

    expect(latestDomProps.onShare).toBeDefined()
  })

  it('calls Share.share with verse text when DOM triggers onShare', async () => {
    const { getByTestId } = render(<VerseOfTheDay versionId={3034} />, {
      wrapper: wrapper(),
    })

    await act(async () => {
      fireEvent.press(getByTestId('mock-share-trigger'))
    })

    expect(Share.share).toHaveBeenCalledTimes(1)
    expect(Share.share).toHaveBeenCalledWith({ message: sampleShareData.text })
  })

  it('does not throw when Share.share rejects', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('Share unavailable'))

    const { getByTestId } = render(<VerseOfTheDay versionId={3034} />, {
      wrapper: wrapper(),
    })

    await act(async () => {
      fireEvent.press(getByTestId('mock-share-trigger'))
    })

    expect(Share.share).toHaveBeenCalledTimes(1)
  })

  it('invokes consumer onShare and does not call Share.share', async () => {
    const consumerOnShare = jest.fn().mockResolvedValue(undefined)
    const { getByTestId } = render(<VerseOfTheDay versionId={3034} onShare={consumerOnShare} />, {
      wrapper: wrapper(),
    })

    await act(async () => {
      fireEvent.press(getByTestId('mock-share-trigger'))
    })

    expect(consumerOnShare).toHaveBeenCalledTimes(1)
    expect(consumerOnShare).toHaveBeenCalledWith(sampleShareData)
    expect(Share.share).not.toHaveBeenCalled()
  })

  it('does not wire onShare on web', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'web',
    })

    const { getByTestId } = render(<VerseOfTheDay versionId={3034} />, {
      wrapper: wrapper(),
    })

    expect(getByTestId('mock-has-share-handler').children).toContain('no')
    await act(async () => {
      fireEvent.press(getByTestId('mock-share-trigger'))
    })
    expect(Share.share).not.toHaveBeenCalled()
  })
})
