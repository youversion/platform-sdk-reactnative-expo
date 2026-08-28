import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
} from '@expo-google-fonts/inter'
import {
  SourceSerif4_400Regular,
  SourceSerif4_500Medium,
  SourceSerif4_700Bold,
} from '@expo-google-fonts/source-serif-4'
import { render, waitFor } from '@testing-library/react-native'
import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import * as Font from 'expo-font'
import * as Localization from 'expo-localization'
import type { Locale } from 'expo-localization'
import { Text } from 'react-native'

import { useLocale } from '../../i18n/locale-context'
import { defaultHookOverrides } from '../../test-utils/default-hook-overrides'
import type { UntitledSerifFont } from '../../theme/fonts'
import { YouVersionProvider } from '../youversion-provider'

const UNTITLED_SERIF_TTF_URI = 'https://cdn.youversion.com/fonts/untitled-serif/regular.ttf'

const UNTITLED_SERIF_PAYLOAD = {
  id: 1,
  slug: 'untitled-serif',
  family: 'Untitled Serif',
  variants: [
    {
      weight: 400,
      style: 'normal',
      sources: [{ format: 'ttf', url: UNTITLED_SERIF_TTF_URI }],
    },
  ],
}

const WOFF2_ONLY_PAYLOAD = {
  id: 1,
  slug: 'untitled-serif',
  family: 'Untitled Serif',
  variants: [
    {
      weight: 400,
      style: 'normal',
      sources: [
        {
          format: 'woff2',
          url: 'https://cdn.youversion.com/fonts/untitled-serif/regular.woff2',
        },
      ],
    },
  ],
}

const BUNDLED_SANS_AND_FALLBACK_SERIF = {
  Inter: Inter_400Regular,
  Inter_medium: Inter_500Medium,
  Inter_bold: Inter_700Bold,
  'Source Serif 4': SourceSerif4_400Regular,
  'Source Serif 4_medium': SourceSerif4_500Medium,
  'Source Serif 4_bold': SourceSerif4_700Bold,
}

const UNTITLED_SERIF_FALLBACK = {
  'Untitled Serif': SourceSerif4_400Regular,
  'Untitled Serif_medium': SourceSerif4_500Medium,
  'Untitled Serif_bold': SourceSerif4_700Bold,
}

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn()

function deviceLocale(languageTag: string, languageCode: string): Locale {
  return {
    languageTag,
    languageCode,
    languageScriptCode: null,
    regionCode: null,
    languageRegionCode: null,
    currencyCode: null,
    currencySymbol: null,
    languageCurrencyCode: null,
    languageCurrencySymbol: null,
    decimalSeparator: '.',
    digitGroupingSeparator: ',',
    textDirection: 'ltr',
    measurementSystem: null,
    temperatureUnit: null,
  }
}

let latestCoreContext: ReturnType<typeof useYouVersion> | null = null

function LocaleProbe() {
  const { lng, i18n } = useLocale()
  return (
    <>
      <Text testID="locale-lng">{lng}</Text>
      <Text testID="i18n-language">{i18n.language}</Text>
    </>
  )
}

function ContextProbe() {
  latestCoreContext = useYouVersion()
  return <LocaleProbe />
}

type FontsApiJson = UntitledSerifFont | { error: string } | { id: number }

function jsonResponse(body: FontsApiJson, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function stubFontsFetch(): void {
  mockFetch.mockReset()
  mockFetch.mockResolvedValue(jsonResponse(UNTITLED_SERIF_PAYLOAD))
  global.fetch = mockFetch
  jest.mocked(Font.loadAsync).mockClear()
}

async function waitForFontMaps(count = 2): Promise<unknown[]> {
  await waitFor(() => {
    expect(jest.mocked(Font.loadAsync).mock.calls.length).toBeGreaterThanOrEqual(count)
  })
  return jest.mocked(Font.loadAsync).mock.calls.map((call) => call[0])
}

describe('YouVersionProvider locale', () => {
  beforeEach(() => {
    latestCoreContext = null
    stubFontsFetch()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // `xx` is not a real language code, so it stays unbundled as locales are synced.
  it('falls back to en when locale prop is omitted and device locale is unsupported', () => {
    jest
      .spyOn(Localization, 'useLocales')
      .mockReturnValue([deviceLocale('xx-XX', 'xx')])

    const { getByTestId } = render(
      <YouVersionProvider appKey="test-key" hookOverrides={defaultHookOverrides}>
        <LocaleProbe />
      </YouVersionProvider>,
    )

    expect(getByTestId('locale-lng').children).toContain('en')
    expect(getByTestId('i18n-language').children).toContain('en')
  })

  it('passes the locale prop through locale context as lng', () => {
    const { getByTestId } = render(
      <YouVersionProvider appKey="test-key" locale="en" hookOverrides={defaultHookOverrides}>
        <LocaleProbe />
      </YouVersionProvider>,
    )

    expect(getByTestId('locale-lng').children).toContain('en')
  })

  it('initializes i18n with resolved lng on first render', () => {
    const { getByTestId } = render(
      <YouVersionProvider appKey="test-key" locale="en" hookOverrides={defaultHookOverrides}>
        <LocaleProbe />
      </YouVersionProvider>,
    )

    expect(getByTestId('i18n-language').children).toContain('en')
  })

  it('forwards version filter lists to core YouVersionProvider', () => {
    render(
      <YouVersionProvider
        appKey="test-key"
        permittedVersionIds={[111]}
        excludedVersionIds={[3034]}
        permittedLanguageTags={['en']}
        hookOverrides={defaultHookOverrides}
      >
        <ContextProbe />
      </YouVersionProvider>,
    )

    expect(latestCoreContext).toEqual(
      expect.objectContaining({
        appKey: 'test-key',
        permittedVersionIds: [111],
        excludedVersionIds: [3034],
        permittedLanguageTags: ['en'],
      }),
    )
  })

  it('forwards empty version filter arrays to core without coercing to undefined', () => {
    render(
      <YouVersionProvider
        appKey="test-key"
        permittedVersionIds={[]}
        excludedVersionIds={[]}
        permittedLanguageTags={[]}
        hookOverrides={defaultHookOverrides}
      >
        <ContextProbe />
      </YouVersionProvider>,
    )

    expect(latestCoreContext?.permittedVersionIds).toEqual([])
    expect(latestCoreContext?.excludedVersionIds).toEqual([])
    expect(latestCoreContext?.permittedLanguageTags).toEqual([])
  })
})

describe('YouVersionProvider brand fonts', () => {
  beforeEach(() => {
    stubFontsFetch()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('commits children without waiting for fonts and fetches Untitled Serif with the app key', async () => {
    const { getByTestId } = render(
      <YouVersionProvider appKey="test-key" hookOverrides={defaultHookOverrides}>
        <LocaleProbe />
      </YouVersionProvider>,
    )

    expect(getByTestId('locale-lng')).toBeTruthy()

    const maps = await waitForFontMaps()
    expect(maps[0]).toEqual(BUNDLED_SANS_AND_FALLBACK_SERIF)
    expect(maps[1]).toEqual({
      'Untitled Serif': { uri: UNTITLED_SERIF_TTF_URI },
    })

    const firstCall = mockFetch.mock.calls[0]
    if (firstCall === undefined) {
      throw new Error('expected fetch to have been called')
    }
    const [url, init] = firstCall
    expect(url).toBe('https://api.youversion.com/v1/fonts/1')
    expect(String(url)).not.toContain('app_key')
    expect(new Headers(init?.headers).get('X-YVP-App-Key')).toBe('test-key')
    expect(new Headers(init?.headers).get('Accept')).toBe('application/json')
  })

  it('does not fetch Untitled Serif when the app key is whitespace', async () => {
    render(
      <YouVersionProvider appKey="   " hookOverrides={defaultHookOverrides}>
        <LocaleProbe />
      </YouVersionProvider>,
    )

    const maps = await waitForFontMaps()
    expect(mockFetch).not.toHaveBeenCalled()
    expect(maps[0]).toEqual(BUNDLED_SANS_AND_FALLBACK_SERIF)
    expect(maps[1]).toEqual(UNTITLED_SERIF_FALLBACK)
  })

  it('loads Source Serif 4 as Untitled Serif when the payload has no TTF', async () => {
    mockFetch.mockResolvedValue(jsonResponse(WOFF2_ONLY_PAYLOAD))

    render(
      <YouVersionProvider appKey="test-key" hookOverrides={defaultHookOverrides}>
        <LocaleProbe />
      </YouVersionProvider>,
    )

    const maps = await waitForFontMaps()
    expect(mockFetch).toHaveBeenCalled()
    expect(maps[0]).toEqual(BUNDLED_SANS_AND_FALLBACK_SERIF)
    expect(maps[1]).toEqual(UNTITLED_SERIF_FALLBACK)
  })

  it('loads Source Serif 4 as Untitled Serif when the Fonts API is not ok', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockResolvedValue(jsonResponse({ error: 'unauthorized' }, 401))

    render(
      <YouVersionProvider appKey="test-key" hookOverrides={defaultHookOverrides}>
        <LocaleProbe />
      </YouVersionProvider>,
    )

    const maps = await waitForFontMaps()
    expect(maps[0]).toEqual(BUNDLED_SANS_AND_FALLBACK_SERIF)
    expect(maps[1]).toEqual(UNTITLED_SERIF_FALLBACK)
  })

  it('loads Source Serif 4 as Untitled Serif when the Fonts API payload does not match', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockResolvedValue(jsonResponse({ id: 1 }))

    render(
      <YouVersionProvider appKey="test-key" hookOverrides={defaultHookOverrides}>
        <LocaleProbe />
      </YouVersionProvider>,
    )

    const maps = await waitForFontMaps()
    expect(maps[0]).toEqual(BUNDLED_SANS_AND_FALLBACK_SERIF)
    expect(maps[1]).toEqual(UNTITLED_SERIF_FALLBACK)
  })
})
