import { render } from '@testing-library/react-native'
import { Text } from 'react-native'

import { useLocale } from '../../i18n/locale-context'
import { YouVersionProvider } from '../youversion-provider'

jest.mock('@youversion/platform-react-native-expo-core', () => ({
  YouVersionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageTag: 'de-DE', languageCode: 'de' }]),
  useLocales: jest.fn(() => [{ languageTag: 'de-DE', languageCode: 'de' }]),
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
  it('uses device locale when locale prop is omitted', () => {
    useLocalesMock.mockReturnValue([{ languageTag: 'de-DE', languageCode: 'de' }])

    const { getByTestId } = render(
      <YouVersionProvider appKey="test-key">
        <LocaleProbe />
      </YouVersionProvider>,
    )

    expect(getByTestId('locale-lng').children).toContain('de-DE')
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
})
