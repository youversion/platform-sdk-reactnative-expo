import type { Locale } from 'expo-localization'

import { SDK_I18N_FALLBACK_LNG } from './constants'
import { supportedSdkLngs } from './locales'

/**
 * Maps BCP-47 language tags to a supported SDK locale code.
 * Mirrors the web React SDK's resolveBrowserLanguage behavior.
 */
export function resolveSdkLocale(
  languageTags: readonly string[],
  supportedLngs: readonly string[] = supportedSdkLngs,
  fallbackLng: string = SDK_I18N_FALLBACK_LNG,
): string {
  if (languageTags.length === 0) {
    return fallbackLng
  }

  const supportedLower = new Map(supportedLngs.map((lng) => [lng.toLowerCase(), lng] as const))

  for (const tag of languageTags) {
    const lower = tag.toLowerCase()
    const exactMatch = supportedLower.get(lower)
    if (exactMatch) {
      return exactMatch
    }

    const base = lower.split('-')[0]
    if (!base) {
      continue
    }

    const baseMatch = supportedLower.get(base)
    if (baseMatch) {
      return baseMatch
    }
  }

  return fallbackLng
}

/** Device primary locale from OS settings, normalized to a supported SDK code. */
export function detectDeviceLocale(primary: Locale | undefined): string {
  const tags: string[] = []
  if (primary?.languageTag) {
    tags.push(primary.languageTag)
  } else if (primary?.languageCode) {
    tags.push(primary.languageCode)
  }

  return resolveSdkLocale(tags)
}
