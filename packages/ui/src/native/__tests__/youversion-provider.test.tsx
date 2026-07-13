import { render } from '@testing-library/react-native'
import { Text } from 'react-native'

import { useLocale } from '../../i18n/locale-context'
import { YouVersionProvider } from '../youversion-provider'

jest.mock('@youversion/platform-react-native-expo-core', () => ({
  YouVersionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageTag: 'fr-FR', languageCode: 'fr' }]),
  useLocales: jest.fn(() => [{ languageTag: 'fr-FR', languageCode: 'fr' }]),
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
  it('falls back to en when locale prop is omitted and device locale is unsupported', () => {
    useLocalesMock.mockReturnValue([{ languageTag: 'fr-FR', languageCode: 'fr' }])

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
})
