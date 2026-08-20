import { render } from '@testing-library/react-native'
import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import * as Localization from 'expo-localization'
import type { Locale } from 'expo-localization'
import { Text } from 'react-native'

import { useLocale } from '../../i18n/locale-context'
import { defaultHookOverrides } from '../../test-utils/default-hook-overrides'
import { YouVersionProvider } from '../youversion-provider'

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

describe('YouVersionProvider locale', () => {
  beforeEach(() => {
    latestCoreContext = null
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
