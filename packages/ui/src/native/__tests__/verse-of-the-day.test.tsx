import { act, fireEvent, render } from '@testing-library/react-native'
import type { VerseOfTheDayShareData } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'
import * as ReactNative from 'react-native'
import { Platform, Pressable, Share, Text, View } from 'react-native'

import { defaultHookOverrides } from '../../test-utils/default-hook-overrides'
import { resetImpls, setImpl } from '../../test-utils/install-test-impls'
import { youVersionProviderWrapper as wrapper } from '../../test-utils/youversion-provider-wrapper'
import { VerseOfTheDay } from '../verse-of-the-day'
import { getDayOfYear, getVerseOfTheDayPassageId } from '../verse-of-the-day-api'
import { YouVersionProvider } from '../youversion-provider'

jest.mock('../verse-of-the-day-api', () => ({
  ...jest.requireActual('../verse-of-the-day-api'),
  getVerseOfTheDayPassageId: jest.fn(async () => null),
}))

const sampleShareData: VerseOfTheDayShareData = {
  text: 'For God so loved the world...\n\nJohn 3:16 NIV',
  reference: 'John 3:16 NIV',
  verseText: 'For God so loved the world...',
}

type LatestDomProps = {
  appKey?: string
  versionId?: number
  dayOfYear?: number
  theme?: string
  permittedVersionIds?: number[]
  excludedVersionIds?: number[]
  permittedLanguageTags?: string[]
  dom?: { matchContents?: boolean; containerStyle?: unknown }
  onShare?: (data: VerseOfTheDayShareData) => Promise<void>
}

let latestDomProps: LatestDomProps = {}

function MockVerseOfTheDayDOM(props: LatestDomProps) {
  latestDomProps = props
  return (
    <View testID="mock-votd-dom">
      <Text testID="mock-app-key">{props.appKey}</Text>
      <Text testID="mock-version-id">{String(props.versionId ?? '')}</Text>
      <Text testID="mock-theme">{props.theme ?? ''}</Text>
      <Text testID="mock-dom-match-contents">{props.dom?.matchContents === true ? '1' : '0'}</Text>
      <Text testID="mock-has-share-handler">{props.onShare ? 'yes' : 'no'}</Text>
      <Pressable
        testID="mock-share-trigger"
        onPress={() => {
          void props.onShare?.(sampleShareData)
        }}
      >
        <Text>share</Text>
      </Pressable>
    </View>
  )
}

describe('VerseOfTheDay', () => {
  const originalOs = Platform.OS

  beforeEach(() => {
    latestDomProps = {}
    setImpl('VerseOfTheDayDom', MockVerseOfTheDayDOM)
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' })
    jest.mocked(getVerseOfTheDayPassageId).mockClear()
  })

  afterEach(() => {
    resetImpls()
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
      showsVerticalScrollIndicator: false,
      showsHorizontalScrollIndicator: false,
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
      'useYouVersion must be used inside of YouVersionProvider',
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

  it('pins a sampled local calendar day on the lookup and the DOM', () => {
    jest.useFakeTimers({ now: new Date(2026, 5, 20) })

    try {
      render(<VerseOfTheDay versionId={3034} />, { wrapper: wrapper() })

      const dayOfYear = getDayOfYear(new Date())
      expect(getVerseOfTheDayPassageId).toHaveBeenCalledWith(
        expect.objectContaining({ appKey: 'test-key' }),
        dayOfYear,
      )
      expect(latestDomProps.dayOfYear).toBe(dayOfYear)
    } finally {
      jest.useRealTimers()
    }
  })

  it('uses a consumer dayOfYear for both the lookup and the DOM', () => {
    jest.useFakeTimers({ now: new Date(2026, 5, 20) })

    try {
      render(<VerseOfTheDay versionId={3034} dayOfYear={1} />, { wrapper: wrapper() })

      expect(getVerseOfTheDayPassageId).toHaveBeenCalledWith(
        expect.objectContaining({ appKey: 'test-key' }),
        1,
      )
      expect(latestDomProps.dayOfYear).toBe(1)
    } finally {
      jest.useRealTimers()
    }
  })

  it('forwards version filter lists from YouVersionProvider to the DOM entry', () => {
    render(<VerseOfTheDay versionId={3034} />, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <YouVersionProvider
          appKey="test-key"
          theme="light"
          hookOverrides={defaultHookOverrides}
          permittedVersionIds={[111]}
          excludedVersionIds={[3034]}
          permittedLanguageTags={['en']}
        >
          {children}
        </YouVersionProvider>
      ),
    })

    expect(latestDomProps.permittedVersionIds).toEqual([111])
    expect(latestDomProps.excludedVersionIds).toEqual([3034])
    expect(latestDomProps.permittedLanguageTags).toEqual(['en'])
  })
})
