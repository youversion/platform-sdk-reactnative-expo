import { detectDeviceLocale, resolveSdkLocale } from '../detect-device-locale'

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
    expect(detectDeviceLocale({ languageTag: 'es-MX', languageCode: 'es' } as any)).toBe('es')
  })

  it('falls back to en when languageCode locale is not bundled', () => {
    expect(detectDeviceLocale({ languageCode: 'fr' } as any)).toBe('en')
  })

  it('falls back to en when no locales are available', () => {
    expect(detectDeviceLocale(undefined)).toBe('en')
  })

  it('resolves bundled locales from regional device tags', () => {
    expect(detectDeviceLocale({ languageTag: 'de-DE', languageCode: 'de' } as any)).toBe('de')
  })

  it('resolves Norwegian device tags to no', () => {
    expect(detectDeviceLocale({ languageTag: 'nb-NO', languageCode: 'nb' } as any)).toBe('no')
    expect(detectDeviceLocale({ languageTag: 'nn-NO', languageCode: 'nn' } as any)).toBe('no')
  })
})
