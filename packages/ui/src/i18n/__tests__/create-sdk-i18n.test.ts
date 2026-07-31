import { SDK_DEFAULT_BRAND_NAME, SDK_I18N_FALLBACK_LNG, SDK_I18N_NAMESPACE } from '../constants'
import { createSdkI18n } from '../create-sdk-i18n'

describe('createSdkI18n', () => {
  it('initializes with the translation namespace and English fallback', () => {
    const i18n = createSdkI18n()

    expect(i18n.options.lng).toBe(SDK_I18N_FALLBACK_LNG)
    expect(i18n.options.fallbackLng).toEqual([SDK_I18N_FALLBACK_LNG])
    expect(i18n.options.defaultNS).toBe(SDK_I18N_NAMESPACE)
    expect(i18n.options.interpolation?.escapeValue).toBe(false)
    expect(i18n.t('signIn')).toBe('Sign in')
  })

  it('interpolates brandName via defaultVariables', () => {
    const i18n = createSdkI18n()

    expect(i18n.t('signInWithYouVersion')).toBe(
      `Sign in with <bold>${SDK_DEFAULT_BRAND_NAME}</bold>`,
    )
  })

  it('uses bundled locale resources when available', async () => {
    const i18n = createSdkI18n()

    await i18n.changeLanguage('es')

    expect(i18n.t('loading')).toBe('Cargando')
  })

  it('falls back to English when locale resources are not bundled', async () => {
    const i18n = createSdkI18n()

    await i18n.changeLanguage('xx')

    expect(i18n.t('loading')).toBe('Loading')
  })

  it('creates an isolated instance separate from the global i18next singleton', () => {
    const first = createSdkI18n()
    const second = createSdkI18n()

    expect(first).not.toBe(second)
  })
})
