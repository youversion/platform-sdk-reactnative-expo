// AUTO-GENERATED — do not edit; run pnpm generate:locale-index
import { SDK_I18N_FALLBACK_LNG, SDK_I18N_NAMESPACE } from '../constants'
import type { SdkTranslationResources } from '../types'
import en from './en.json'
import af from './af.json'
import ar from './ar.json'
import cs from './cs.json'
import cy from './cy.json'
import de from './de.json'
import es from './es.json'
import fi from './fi.json'
import hu from './hu.json'
import ig from './ig.json'
import it from './it.json'
import ko from './ko.json'
import nl from './nl.json'
import no from './no.json'
import pt from './pt.json'
import ru from './ru.json'
import sr from './sr.json'
import sv from './sv.json'
import tr from './tr.json'
import uk from './uk.json'
import vi from './vi.json'
import zh from './zh.json'

/** Locales with bundled translation resources (synced from platform-localization). */
const localeResources = {
  [SDK_I18N_FALLBACK_LNG]: en,
  af: af,
  ar: ar,
  cs: cs,
  cy: cy,
  de: de,
  es: es,
  fi: fi,
  hu: hu,
  ig: ig,
  it: it,
  ko: ko,
  nl: nl,
  no: no,
  pt: pt,
  ru: ru,
  sr: sr,
  sv: sv,
  tr: tr,
  uk: uk,
  vi: vi,
  zh: zh,
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
