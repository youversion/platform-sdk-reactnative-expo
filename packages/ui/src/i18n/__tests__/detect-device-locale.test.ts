import { detectDeviceLocale } from '../detect-device-locale'

describe('detectDeviceLocale', () => {
  it('prefers languageTag over languageCode', () => {
    expect(detectDeviceLocale({ languageTag: 'es-MX', languageCode: 'es' } as any)).toBe('es-MX')
  })

  it('falls back to languageCode when languageTag is missing', () => {
    expect(detectDeviceLocale({ languageCode: 'fr' } as any)).toBe('fr')
  })

  it('falls back to en when no locales are available', () => {
    expect(detectDeviceLocale(undefined)).toBe('en')
  })
})
