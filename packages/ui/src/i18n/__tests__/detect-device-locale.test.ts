import { getLocales } from 'expo-localization'

import { detectDeviceLocale } from '../detect-device-locale'

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(),
}))

const getLocalesMock = getLocales as jest.Mock

describe('detectDeviceLocale', () => {
  it('prefers languageTag over languageCode', () => {
    getLocalesMock.mockReturnValue([{ languageTag: 'es-MX', languageCode: 'es' }])

    expect(detectDeviceLocale()).toBe('es-MX')
  })

  it('falls back to languageCode when languageTag is missing', () => {
    getLocalesMock.mockReturnValue([{ languageCode: 'fr' }])

    expect(detectDeviceLocale()).toBe('fr')
  })

  it('falls back to en when no locales are available', () => {
    getLocalesMock.mockReturnValue([])

    expect(detectDeviceLocale()).toBe('en')
  })
})
