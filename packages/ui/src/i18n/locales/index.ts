import { SDK_I18N_FALLBACK_LNG, SDK_I18N_NAMESPACE } from '../constants'
import type { SdkTranslationResources } from '../types'
import ar from './ar.json'
import cy from './cy.json'
import de from './de.json'
import en from './en.json'
import es from './es.json'
import ig from './ig.json'
import ko from './ko.json'
import pt from './pt.json'
import ru from './ru.json'
import tr from './tr.json'
import vi from './vi.json'
import zh from './zh.json'

/** Locales with bundled translation resources (synced from platform-localization). */
const localeResources = {
  ar,
  cy,
  de,
  [SDK_I18N_FALLBACK_LNG]: en,
  es,
  ig,
  ko,
  pt,
  ru,
  tr,
  vi,
  zh,
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
