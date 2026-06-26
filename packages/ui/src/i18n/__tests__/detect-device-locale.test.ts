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
    expect(resolveSdkLocale(['de-DE', 'fr-FR', 'en-US'], supportedLngs, fallbackLng)).toBe(
      'fr',
    )
  })
})

describe('detectDeviceLocale', () => {
  it('normalizes languageTag to a supported 2-letter code', () => {
    expect(detectDeviceLocale({ languageTag: 'es-MX', languageCode: 'es' } as any)).toBe('es')
  })

  it('normalizes languageCode when languageTag is missing', () => {
    expect(detectDeviceLocale({ languageCode: 'fr' } as any)).toBe('fr')
  })

  it('falls back to en when no locales are available', () => {
    expect(detectDeviceLocale(undefined)).toBe('en')
  })

  it('falls back to en for unsupported device locales', () => {
    expect(detectDeviceLocale({ languageTag: 'de-DE', languageCode: 'de' } as any)).toBe('en')
  })
})
