import { getLocales } from 'expo-localization'

import { SDK_I18N_FALLBACK_LNG } from './constants'

/** Device primary locale from OS settings (BCP 47 when available). */
export function detectDeviceLocale(): string {
  const primary = getLocales()[0]
  return primary?.languageTag ?? primary?.languageCode ?? SDK_I18N_FALLBACK_LNG
}
