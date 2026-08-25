import type { Locale } from 'expo-localization'

import { detectDeviceLocale, resolveSdkLocale } from '../detect-device-locale'

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

const supportedLngs = ['en', 'fr', 'es'] as const
const fallbackLng = 'en'

describe('resolveSdkLocale', () => {
  it('maps regional English tags to en', () => {
    expect(resolveSdkLocale(['en-US', 'en'], supportedLngs, fallbackLng)).toBe('en')
  })

  it('maps regional French tags to fr', () => {
    expect(resolveSdkLocale(['fr-FR', 'fr'], supportedLngs, fallbackLng)).toBe('fr')
  })

  it('maps regional Spanish tags to es', () => {
    expect(resolveSdkLocale(['es-MX', 'es'], supportedLngs, fallbackLng)).toBe('es')
  })

  it('falls back to en for unsupported language tags', () => {
    expect(resolveSdkLocale(['de-DE', 'de'], supportedLngs, fallbackLng)).toBe('en')
  })

  it('falls back to en when no tags are provided', () => {
    expect(resolveSdkLocale([], supportedLngs, fallbackLng)).toBe('en')
  })

  it('uses the first supported language in the preference list', () => {
    expect(resolveSdkLocale(['de-DE', 'fr-FR', 'en-US'], supportedLngs, fallbackLng)).toBe('fr')
  })

  it('maps Norwegian Bokmål and Nynorsk tags to no', () => {
    const withNorwegian = ['en', 'no'] as const
    expect(resolveSdkLocale(['nb-NO'], withNorwegian, fallbackLng)).toBe('no')
    expect(resolveSdkLocale(['nn-NO'], withNorwegian, fallbackLng)).toBe('no')
    expect(resolveSdkLocale(['nb'], withNorwegian, fallbackLng)).toBe('no')
    expect(resolveSdkLocale(['nn'], withNorwegian, fallbackLng)).toBe('no')
  })
})

describe('detectDeviceLocale', () => {
  it('resolves bundled locales from languageTag', () => {
    expect(detectDeviceLocale(deviceLocale('es-MX', 'es'))).toBe('es')
  })

  // `xx` is not a real language code, so it stays unbundled as locales are synced.
  it('falls back to en when languageCode locale is not bundled', () => {
    expect(detectDeviceLocale(deviceLocale('xx', 'xx'))).toBe('en')
  })

  it('falls back to en when no locales are available', () => {
    expect(detectDeviceLocale(undefined)).toBe('en')
  })

  it('resolves bundled locales from regional device tags', () => {
    expect(detectDeviceLocale(deviceLocale('de-DE', 'de'))).toBe('de')
  })

  it('resolves Norwegian device tags to no', () => {
    expect(detectDeviceLocale(deviceLocale('nb-NO', 'nb'))).toBe('no')
    expect(detectDeviceLocale(deviceLocale('nn-NO', 'nn'))).toBe('no')
  })
})
