import { SDK_I18N_FALLBACK_LNG, SDK_I18N_NAMESPACE } from '../constants'
import type { SdkTranslationResources } from '../types'
import en from './en.json'
import es from './es.json'
import fr from './fr.json'

/** Locales with bundled translation resources (synced from platform-localization). */
const localeResources = {
  [SDK_I18N_FALLBACK_LNG]: en,
  es,
  fr,
} satisfies Record<string, SdkTranslationResources>

export const supportedSdkLngs = Object.keys(localeResources)

export function buildSdkResources() {
  return Object.fromEntries(
    Object.entries(localeResources).map(([lng, translation]) => [
      lng,
      { [SDK_I18N_NAMESPACE]: translation },
    ]),
  )
}
