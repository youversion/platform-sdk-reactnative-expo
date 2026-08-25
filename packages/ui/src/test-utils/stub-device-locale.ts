import * as Localization from 'expo-localization'
import type { Locale } from 'expo-localization'

/** Steer `useLocales` for device-resolved lng tests without `jest.mock`. */
export function stubDeviceLocale(languageTag: string, languageCode: string): void {
  const locale = {
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
  } satisfies Locale

  jest.spyOn(Localization, 'useLocales').mockReturnValue([locale])
}
