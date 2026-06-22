import { createInstance, type i18n as I18nInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'

import {
  SDK_DEFAULT_BRAND_NAME,
  SDK_I18N_FALLBACK_LNG,
  SDK_I18N_NAMESPACE,
} from './constants'
import { buildSdkResources } from './locales'

export function createSdkI18n(lng: string = SDK_I18N_FALLBACK_LNG): I18nInstance {
  const i18n = createInstance()

  void i18n.use(initReactI18next).init({
    resources: buildSdkResources(),
    lng,
    fallbackLng: SDK_I18N_FALLBACK_LNG,
    ns: [SDK_I18N_NAMESPACE],
    defaultNS: SDK_I18N_NAMESPACE,
    interpolation: {
      escapeValue: false,
      defaultVariables: {
        brandName: SDK_DEFAULT_BRAND_NAME,
      },
    },
  })

  return i18n
}
