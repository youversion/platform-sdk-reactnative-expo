import type { Locale } from 'expo-localization'

import { SDK_I18N_FALLBACK_LNG } from './constants'
import { supportedSdkLngs } from './locales'

/**
 * BCP-47 tags that should resolve to a different bundled locale code.
 * Norwegian devices report `nb` / `nn`; platform-localization ships `no`.
 */
const SDK_LOCALE_ALIASES: Readonly<Record<string, string>> = {
  nb: 'no',
  nn: 'no',
}

function lookupSupportedLocale(
  tag: string,
  supportedLower: ReadonlyMap<string, string>,
): string | undefined {
  const direct = supportedLower.get(tag)
  if (direct) {
    return direct
  }

  const aliased = SDK_LOCALE_ALIASES[tag]
  if (!aliased) {
    return undefined
  }

  return supportedLower.get(aliased)
}

/**
 * Maps BCP-47 language tags to a supported SDK locale code.
 * Mirrors the web React SDK's resolveBrowserLanguage behavior, plus locale aliases.
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
    const exactMatch = lookupSupportedLocale(lower, supportedLower)
    if (exactMatch) {
      return exactMatch
    }

    const base = lower.split('-')[0]
    if (!base) {
      continue
    }

    const baseMatch = lookupSupportedLocale(base, supportedLower)
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
