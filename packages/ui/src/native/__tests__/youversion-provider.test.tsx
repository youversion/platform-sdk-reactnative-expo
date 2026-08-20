import { render } from '@testing-library/react-native'
import { Text } from 'react-native'

import { useLocale } from '../../i18n/locale-context'
import { YouVersionProvider } from '../youversion-provider'

let latestCoreProviderProps: Record<string, unknown> = {}

jest.mock('@youversion/platform-react-native-expo-core', () => ({
  YouVersionProvider: (props: Record<string, unknown>) => {
    latestCoreProviderProps = props
    return props.children
  },
}))

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageTag: 'xx-XX', languageCode: 'xx' }]),
  useLocales: jest.fn(() => [{ languageTag: 'xx-XX', languageCode: 'xx' }]),
}))

const useLocalesMock = jest.requireMock('expo-localization').useLocales as jest.Mock

function LocaleProbe() {
  const { lng, i18n } = useLocale()
  return (
    <>
      <Text testID="locale-lng">{lng}</Text>
      <Text testID="i18n-language">{i18n.language}</Text>
    </>
  )
}

describe('YouVersionProvider locale', () => {
  beforeEach(() => {
    latestCoreProviderProps = {}
  })

  // `xx` is not a real language code, so it stays unbundled as locales are synced.
  it('falls back to en when locale prop is omitted and device locale is unsupported', () => {
    useLocalesMock.mockReturnValue([{ languageTag: 'xx-XX', languageCode: 'xx' }])

    const { getByTestId } = render(
      <YouVersionProvider appKey="test-key">
        <LocaleProbe />
      </YouVersionProvider>,
    )

    expect(getByTestId('locale-lng').children).toContain('en')
    expect(getByTestId('i18n-language').children).toContain('en')
  })

  it('passes the locale prop through locale context as lng', () => {
    const { getByTestId } = render(
      <YouVersionProvider appKey="test-key" locale="en">
        <LocaleProbe />
      </YouVersionProvider>,
    )

    expect(getByTestId('locale-lng').children).toContain('en')
  })

  it('initializes i18n with resolved lng on first render', () => {
    const { getByTestId } = render(
      <YouVersionProvider appKey="test-key" locale="en">
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
      >
        <LocaleProbe />
      </YouVersionProvider>,
    )

    expect(latestCoreProviderProps).toEqual(
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
      >
        <LocaleProbe />
      </YouVersionProvider>,
    )

    expect(latestCoreProviderProps.permittedVersionIds).toEqual([])
    expect(latestCoreProviderProps.excludedVersionIds).toEqual([])
    expect(latestCoreProviderProps.permittedLanguageTags).toEqual([])
  })
})
