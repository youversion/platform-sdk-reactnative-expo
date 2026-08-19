import { render } from '@testing-library/react-native'
import * as Localization from 'expo-localization'
import { Text } from 'react-native'

import { useLocale } from '../../i18n/locale-context'
import { defaultHookOverrides } from '../../test-utils/default-hook-overrides'
import { YouVersionProvider } from '../youversion-provider'

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
  afterEach(() => {
    jest.restoreAllMocks()
  })

  // `xx` is not a real language code, so it stays unbundled as locales are synced.
  it('falls back to en when locale prop is omitted and device locale is unsupported', () => {
    jest
      .spyOn(Localization, 'useLocales')
      .mockReturnValue([{ languageTag: 'xx-XX', languageCode: 'xx' }] as Localization.Locale[])

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
})
