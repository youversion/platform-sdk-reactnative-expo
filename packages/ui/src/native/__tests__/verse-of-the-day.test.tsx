import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native'
import type { VerseOfTheDayShareData } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'
import * as ReactNative from 'react-native'
import { Platform, Share, StyleSheet, Text, View } from 'react-native'

import { FONT_FAMILY_TOKEN } from '../../lib/reader-fonts'
import { defaultHookOverrides } from '../../test-utils/default-hook-overrides'
import { resetImpls, setImpl } from '../../test-utils/install-test-impls'
import { stubDeviceLocale } from '../../test-utils/stub-device-locale'
import { youVersionProviderWrapper as wrapper } from '../../test-utils/youversion-provider-wrapper'
import { getTokens } from '../../theme'
import { VerseOfTheDay } from '../verse-of-the-day'
import * as votdApi from '../verse-of-the-day-api'
import * as votdShare from '../verse-of-the-day-share'
import { YouVersionProvider } from '../youversion-provider'

const sampleShareData: VerseOfTheDayShareData = {
  text: 'For God so loved the world...\n\nJohn 3:16 NIV',
  reference: 'John 3:16 NIV',
  verseText: 'For God so loved the world...',
}

const EMBED_DEFAULTS = {
  matchContents: true,
  containerStyle: { flex: 0, width: '100%' },
  scrollEnabled: false,
  bounces: false,
  overScrollMode: 'never',
  showsVerticalScrollIndicator: false,
  showsHorizontalScrollIndicator: false,
} as const

type LatestDomProps = {
  appKey?: string
  apiHost?: string
  fetchBibleContent?: unknown
  reference?: string
  versionId?: number
  dayOfYear?: number
  theme?: string
  locale?: string
  fontSize?: number
  fontFamily?: string
  showVerseNumbers?: boolean
  highlights?: unknown
  permittedVersionIds?: number[]
  excludedVersionIds?: number[]
  permittedLanguageTags?: string[]
  dom?: { matchContents?: boolean; containerStyle?: unknown }
  onShare?: (data: VerseOfTheDayShareData) => Promise<void>
}

let latestDomProps: LatestDomProps = {}

// Passage lookup and the share-source fetch each resolve in a microtask.
async function renderAndSettle(...args: Parameters<typeof render>) {
  const result = render(...args)
  await act(async () => {})
  await act(async () => {})
  return result
}

function MockBibleTextViewDOM(props: LatestDomProps) {
  latestDomProps = props
  return (
    <View testID="mock-btv-dom">
      <Text testID="mock-app-key">{props.appKey}</Text>
      <Text testID="mock-reference">{props.reference ?? ''}</Text>
      <Text testID="mock-version-id">{String(props.versionId ?? '')}</Text>
      <Text testID="mock-theme">{props.theme ?? ''}</Text>
      <Text testID="mock-font-size">{String(props.fontSize ?? '')}</Text>
      <Text testID="mock-font-family">{props.fontFamily ?? ''}</Text>
      <Text testID="mock-show-verse-numbers">{props.showVerseNumbers === true ? '1' : '0'}</Text>
      <Text testID="mock-dom-match-contents">{props.dom?.matchContents === true ? '1' : '0'}</Text>
    </View>
  )
}

describe('VerseOfTheDay', () => {
  const originalOs = Platform.OS

  beforeEach(() => {
    latestDomProps = {}
    stubDeviceLocale('xx-XX', 'xx')
    setImpl('BibleTextViewDom', MockBibleTextViewDOM)
    setImpl('BibleAppLogo', (props) => <View testID="bible-app-logo" {...props} />)
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' })
    jest.spyOn(votdApi, 'getVerseOfTheDayPassageId').mockResolvedValue('JHN.3.16')
    jest.spyOn(votdShare, 'getVerseOfTheDayShareSource').mockResolvedValue(sampleShareData)
  })

  afterEach(() => {
    cleanup()
    resetImpls()
    jest.restoreAllMocks()
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: originalOs,
    })
  })

  it('renders native chrome around the DOM BibleTextView', async () => {
    const { getByTestId, getByLabelText, getByText } = await renderAndSettle(
      <VerseOfTheDay versionId={3034} />,
      { wrapper: wrapper() },
    )

    expect(getByTestId('verse-of-the-day')).toBeTruthy()
    expect(getByText('Verse of the Day')).toBeTruthy()
    expect(getByText('John 3:16 NIV')).toBeTruthy()
    expect(getByLabelText('Share')).toBeTruthy()
    expect(getByTestId('verse-of-the-day-sun')).toBeTruthy()
    expect(getByTestId('verse-of-the-day-attribution')).toBeTruthy()
    expect(getByText('Bible App')).toBeTruthy()
    expect(getByTestId('mock-btv-dom')).toBeTruthy()
  })

  it('paints the card surface from the light tokens', async () => {
    const { getByTestId } = await renderAndSettle(<VerseOfTheDay versionId={3034} />, {
      wrapper: wrapper('light'),
    })

    expect(StyleSheet.flatten(getByTestId('verse-of-the-day').props.style)).toMatchObject({
      backgroundColor: getTokens('light').card,
    })
  })

  it('paints the card surface from the dark tokens', async () => {
    const { getByTestId } = await renderAndSettle(<VerseOfTheDay versionId={3034} />, {
      wrapper: wrapper('dark'),
    })

    expect(StyleSheet.flatten(getByTestId('verse-of-the-day').props.style)).toMatchObject({
      backgroundColor: getTokens('dark').card,
    })
  })

  it('forwards appKey from YouVersionProvider and the passage to BibleTextView', async () => {
    const { getByTestId } = await renderAndSettle(
      <VerseOfTheDay versionId={3034} dom={{ matchContents: true }} />,
      { wrapper: wrapper() },
    )

    expect(getByTestId('mock-app-key').children).toContain('test-key')
    expect(getByTestId('mock-reference').children).toContain('JHN.3.16')
    expect(getByTestId('mock-version-id').children).toContain('3034')
    expect(getByTestId('mock-show-verse-numbers').children).toContain('0')
    expect(getByTestId('mock-dom-match-contents').children).toContain('1')
    expect(latestDomProps.apiHost).toBe('api.youversion.com')
    expect(latestDomProps.fetchBibleContent).toEqual(expect.any(Function))
    expect(latestDomProps).not.toHaveProperty('onShare')
    expect(latestDomProps).not.toHaveProperty('dayOfYear')
  })

  it('applies the embed dom defaults when no dom prop is passed', async () => {
    await renderAndSettle(<VerseOfTheDay versionId={3034} />, { wrapper: wrapper() })

    expect(latestDomProps.dom).toEqual(EMBED_DEFAULTS)
  })

  it('merges a consumer containerStyle after the embed defaults', async () => {
    await renderAndSettle(
      <VerseOfTheDay versionId={3034} dom={{ containerStyle: { width: 300 } }} />,
      {
        wrapper: wrapper(),
      },
    )

    expect(latestDomProps.dom?.containerStyle).toEqual([{ flex: 0, width: '100%' }, { width: 300 }])
  })

  it('forwards a component-level theme override to BibleTextView as light or dark', async () => {
    const { getByTestId } = await renderAndSettle(<VerseOfTheDay versionId={3034} theme="dark" />, {
      wrapper: wrapper('light'),
    })

    expect(getByTestId('mock-theme').children).toContain('dark')
    expect(StyleSheet.flatten(getByTestId('verse-of-the-day').props.style)).toMatchObject({
      backgroundColor: getTokens('dark').card,
    })
  })

  it('resolves theme="system" to light or dark before it crosses the bridge', async () => {
    await renderAndSettle(<VerseOfTheDay versionId={3034} theme="system" />, {
      wrapper: wrapper('light'),
    })

    expect(latestDomProps.theme).toBe('light')
  })

  it('uses the provider-resolved theme when VerseOfTheDay does not set theme', async () => {
    const { getByTestId } = await renderAndSettle(<VerseOfTheDay versionId={3034} />, {
      wrapper: wrapper('dark'),
    })

    expect(getByTestId('mock-theme').children).toContain('dark')
  })

  it('uses provider-resolved theme when provider theme is system and color scheme is dark', async () => {
    const spy = jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark')

    const { getByTestId } = await renderAndSettle(<VerseOfTheDay versionId={3034} />, {
      wrapper: wrapper('system'),
    })

    try {
      expect(getByTestId('mock-theme').children).toContain('dark')
    } finally {
      spy.mockRestore()
    }
  })

  it('honors the web background prop when theme is omitted', async () => {
    await renderAndSettle(<VerseOfTheDay versionId={3034} background="dark" />, {
      wrapper: wrapper('light'),
    })

    expect(latestDomProps.theme).toBe('dark')
  })

  it('encodes the default sans face and a 16px verse on size="default"', async () => {
    const { getByTestId } = await renderAndSettle(<VerseOfTheDay versionId={3034} />, {
      wrapper: wrapper(),
    })

    expect(getByTestId('mock-font-size').children).toContain('16')
    expect(getByTestId('mock-font-family').children).toContain(FONT_FAMILY_TOKEN.INTER)
  })

  it('encodes the serif face and a 20px verse on size="lg"', async () => {
    const { getByTestId } = await renderAndSettle(<VerseOfTheDay versionId={3034} size="lg" />, {
      wrapper: wrapper(),
    })

    expect(getByTestId('mock-font-size').children).toContain('20')
    expect(getByTestId('mock-font-family').children).toContain(FONT_FAMILY_TOKEN.UNTITLED_SERIF)
  })

  it('throws when YouVersionProvider is missing', () => {
    expect(() => render(<VerseOfTheDay versionId={3034} />)).toThrow(
      'useYouVersion must be used inside of YouVersionProvider',
    )
  })

  it('calls Share.share with verse text when the native share button is pressed', async () => {
    const { getByTestId } = await renderAndSettle(<VerseOfTheDay versionId={3034} />, {
      wrapper: wrapper(),
    })

    await act(async () => {
      fireEvent.press(getByTestId('verse-of-the-day-share'))
    })

    expect(Share.share).toHaveBeenCalledTimes(1)
    expect(Share.share).toHaveBeenCalledWith({ message: sampleShareData.text })
  })

  it('does not throw when Share.share rejects', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('Share unavailable'))

    const { getByTestId } = await renderAndSettle(<VerseOfTheDay versionId={3034} />, {
      wrapper: wrapper(),
    })

    await act(async () => {
      fireEvent.press(getByTestId('verse-of-the-day-share'))
    })

    expect(Share.share).toHaveBeenCalledTimes(1)
  })

  it('retries the share-source fetch on press after the background fetch failed', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const shareSourceSpy = jest
      .spyOn(votdShare, 'getVerseOfTheDayShareSource')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(sampleShareData)

    const { getByTestId, queryByText } = await renderAndSettle(
      <VerseOfTheDay versionId={3034} />,
      { wrapper: wrapper() },
    )
    expect(queryByText(sampleShareData.reference)).toBeNull()
    expect(getByTestId('verse-of-the-day-share')).not.toBeDisabled()

    // First press: the retry also fails, so nothing is shared.
    await act(async () => {
      fireEvent.press(getByTestId('verse-of-the-day-share'))
    })
    expect(Share.share).not.toHaveBeenCalled()

    // Second press: the retry succeeds, shares, and the reference line appears.
    await act(async () => {
      fireEvent.press(getByTestId('verse-of-the-day-share'))
    })
    expect(shareSourceSpy).toHaveBeenCalledTimes(3)
    expect(Share.share).toHaveBeenCalledWith({ message: sampleShareData.text })
    expect(queryByText(sampleShareData.reference)).toBeTruthy()
  })

  it('invokes consumer onShare and does not call Share.share', async () => {
    const consumerOnShare = jest.fn().mockResolvedValue(undefined)
    const { getByTestId } = await renderAndSettle(
      <VerseOfTheDay versionId={3034} onShare={consumerOnShare} />,
      {
        wrapper: wrapper(),
      },
    )

    await act(async () => {
      fireEvent.press(getByTestId('verse-of-the-day-share'))
    })

    expect(consumerOnShare).toHaveBeenCalledTimes(1)
    expect(consumerOnShare).toHaveBeenCalledWith(sampleShareData)
    expect(Share.share).not.toHaveBeenCalled()
  })

  it('does not call Share.share on web', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'web',
    })

    const { getByTestId } = await renderAndSettle(<VerseOfTheDay versionId={3034} />, {
      wrapper: wrapper(),
    })

    await act(async () => {
      fireEvent.press(getByTestId('verse-of-the-day-share'))
    })
    expect(Share.share).not.toHaveBeenCalled()
  })

  it('hides optional chrome when the public flags are false', async () => {
    const { queryByTestId, queryByLabelText } = await renderAndSettle(
      <VerseOfTheDay
        versionId={3034}
        showSunIcon={false}
        showShareButton={false}
        showBibleAppAttribution={false}
      />,
      { wrapper: wrapper() },
    )

    expect(queryByTestId('verse-of-the-day-sun')).toBeNull()
    expect(queryByLabelText('Share')).toBeNull()
    expect(queryByTestId('verse-of-the-day-attribution')).toBeNull()
  })

  it('shows a loading state until the passage_id is known', () => {
    jest.spyOn(votdApi, 'getVerseOfTheDayPassageId').mockReturnValue(new Promise(() => undefined))

    const { getByTestId, queryByTestId } = render(<VerseOfTheDay versionId={3034} />, {
      wrapper: wrapper(),
    })

    expect(getByTestId('verse-of-the-day-loading')).toBeTruthy()
    expect(queryByTestId('mock-btv-dom')).toBeNull()
    expect(getByTestId('verse-of-the-day-share')).toBeDisabled()
  })

  it('shows a retry control when the passage lookup fails', async () => {
    jest.spyOn(votdApi, 'getVerseOfTheDayPassageId').mockResolvedValue(null)

    const { getByTestId, getByLabelText, queryByTestId } = await renderAndSettle(
      <VerseOfTheDay versionId={3034} />,
      {
        wrapper: wrapper(),
      },
    )

    expect(getByTestId('verse-of-the-day-retry')).toBeTruthy()
    expect(getByLabelText('We’re having difficulties with your connection.')).toBeTruthy()
    expect(queryByTestId('verse-of-the-day-loading')).toBeNull()
    expect(queryByTestId('mock-btv-dom')).toBeNull()
    expect(getByTestId('verse-of-the-day-share')).toBeDisabled()
  })

  it('recovers from a failed passage lookup when retry is pressed', async () => {
    jest
      .spyOn(votdApi, 'getVerseOfTheDayPassageId')
      .mockResolvedValueOnce(null)
      .mockResolvedValue('JHN.3.16')

    const { getByTestId, queryByTestId } = await renderAndSettle(
      <VerseOfTheDay versionId={3034} />,
      { wrapper: wrapper() },
    )

    expect(queryByTestId('mock-btv-dom')).toBeNull()

    await act(async () => {
      fireEvent.press(getByTestId('verse-of-the-day-retry'))
    })
    await waitFor(() => {
      expect(getByTestId('mock-btv-dom')).toBeTruthy()
    })
    expect(queryByTestId('verse-of-the-day-retry')).toBeNull()
    expect(getByTestId('verse-of-the-day-share')).not.toBeDisabled()
  })

  it('pins a sampled local calendar day on the lookup and the scripture reference', async () => {
    jest.useFakeTimers({ now: new Date(2026, 5, 20) })

    try {
      await renderAndSettle(<VerseOfTheDay versionId={3034} />, { wrapper: wrapper() })

      const dayOfYear = votdApi.getDayOfYear(new Date())
      expect(votdApi.getVerseOfTheDayPassageId).toHaveBeenCalledWith(
        expect.objectContaining({ appKey: 'test-key' }),
        dayOfYear,
      )
      expect(latestDomProps.reference).toBe('JHN.3.16')
    } finally {
      jest.useRealTimers()
    }
  })

  it('uses a consumer dayOfYear for the lookup', async () => {
    jest.useFakeTimers({ now: new Date(2026, 5, 20) })

    try {
      await renderAndSettle(<VerseOfTheDay versionId={3034} dayOfYear={1} />, {
        wrapper: wrapper(),
      })

      expect(votdApi.getVerseOfTheDayPassageId).toHaveBeenCalledWith(
        expect.objectContaining({ appKey: 'test-key' }),
        1,
      )
    } finally {
      jest.useRealTimers()
    }
  })

  it('forwards version filter lists from YouVersionProvider to BibleTextView', async () => {
    await renderAndSettle(<VerseOfTheDay versionId={3034} />, {
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

  it('forwards resolved locale from YouVersionProvider to BibleTextView', async () => {
    await renderAndSettle(<VerseOfTheDay versionId={3034} />, { wrapper: wrapper('light', 'es') })

    expect(latestDomProps.locale).toBe('es')
  })

  it('forwards device-resolved locale to BibleTextView when provider locale is omitted', async () => {
    stubDeviceLocale('es-MX', 'es')

    await renderAndSettle(<VerseOfTheDay versionId={3034} />, { wrapper: wrapper() })

    expect(latestDomProps.locale).toBe('es')
  })
})
