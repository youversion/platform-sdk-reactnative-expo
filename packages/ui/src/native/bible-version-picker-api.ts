import type { BibleClient, LanguagesClient } from '@youversion/platform-core'

export type VersionPickerLanguage = {
  id: string
  displayNames: Readonly<Record<string, string>>
  speakingPopulation?: number
}

export type VersionPickerVersion = {
  id: number
  title: string
  localizedTitle: string
  abbreviation: string
  localizedAbbreviation: string
  languageTag: string
  organizationId?: string | null
}

export type VersionPickerCatalogClients = {
  languagesClient: Pick<LanguagesClient, 'getLanguages'>
  bibleClient: Pick<BibleClient, 'getVersions'>
}

const LANGUAGE_LIST_FIELDS = ['id', 'display_names', 'speaking_population'] as const
const SUGGESTED_LANGUAGE_FIELDS = ['id', 'display_names'] as const
const VERSION_LANGUAGE_FIELDS = ['id', 'language_tag'] as const
// BibleClient throws when page_size is '*' and fields has more than three entries.
const VERSION_SUMMARY_FIELDS = ['id', 'localized_title', 'localized_abbreviation'] as const

function parseLanguage(raw: {
  id: string
  display_names?: Readonly<Record<string, string>>
  speaking_population?: number
}): VersionPickerLanguage {
  return {
    id: raw.id,
    displayNames: raw.display_names ?? {},
    speakingPopulation: raw.speaking_population,
  }
}

function parseVersion(
  raw: {
    id: number
    title?: string
    localized_title?: string
    abbreviation?: string
    localized_abbreviation?: string
    language_tag?: string
    organization_id?: string | null
  },
  languageTag: string,
): VersionPickerVersion {
  const localizedTitle = raw.localized_title || raw.title || ''
  const localizedAbbreviation = raw.localized_abbreviation || raw.abbreviation || ''
  return {
    id: raw.id,
    title: raw.title || localizedTitle,
    localizedTitle,
    abbreviation: raw.abbreviation || localizedAbbreviation,
    localizedAbbreviation,
    languageTag: raw.language_tag || languageTag,
    organizationId: raw.organization_id ?? null,
  }
}

export async function fetchVersionPickerLanguages(
  clients: VersionPickerCatalogClients,
): Promise<readonly VersionPickerLanguage[]> {
  const response = await clients.languagesClient.getLanguages({
    fields: [...LANGUAGE_LIST_FIELDS],
    page_size: '*',
  })
  return (response.data ?? []).map(parseLanguage)
}

export async function fetchSuggestedVersionPickerLanguages(
  clients: VersionPickerCatalogClients,
): Promise<readonly VersionPickerLanguage[]> {
  const response = await clients.languagesClient.getLanguages({
    country: 'zz',
    fields: [...SUGGESTED_LANGUAGE_FIELDS],
    page_size: '*',
  })
  return (response.data ?? []).map(parseLanguage)
}

export async function fetchVersionsForLanguage(
  clients: VersionPickerCatalogClients,
  languageId: string,
): Promise<readonly VersionPickerVersion[]> {
  const response = await clients.bibleClient.getVersions(languageId, undefined, {
    fields: [...VERSION_SUMMARY_FIELDS],
    page_size: '*',
  })
  return (response.data ?? []).map((version) => parseVersion(version, languageId))
}

export async function fetchVersionLanguageTags(
  clients: VersionPickerCatalogClients,
): Promise<ReadonlyMap<number, string>> {
  const response = await clients.bibleClient.getVersions('*', undefined, {
    fields: [...VERSION_LANGUAGE_FIELDS],
    page_size: '*',
  })
  const tags = new Map<number, string>()
  for (const version of response.data ?? []) {
    tags.set(version.id, version.language_tag)
  }
  return tags
}

export async function fetchAllVersionSummaries(
  clients: VersionPickerCatalogClients,
): Promise<readonly VersionPickerVersion[]> {
  const response = await clients.bibleClient.getVersions('*', undefined, {
    fields: [...VERSION_SUMMARY_FIELDS],
    page_size: '*',
  })
  return (response.data ?? []).map((version) => parseVersion(version, ''))
}

export function languagesWithBibles(
  languages: readonly VersionPickerLanguage[],
  versionLanguageTags: ReadonlyMap<number, string>,
): VersionPickerLanguage[] {
  const versionLanguages = [...versionLanguageTags.values()]
  const unique = [
    ...new Map(
      languages
        .filter(
          (language) =>
            language.displayNames.en !== undefined && versionLanguages.includes(language.id),
        )
        .map((language) => [language.id, language]),
    ).values(),
  ]
  return unique.sort((a, b) =>
    (a.displayNames.en ?? a.id).localeCompare(b.displayNames.en ?? b.id, 'en', {
      sensitivity: 'base',
    }),
  )
}

export function buildSuggestedLanguages(
  uniqueLanguages: readonly VersionPickerLanguage[],
  countryLanguages: readonly VersionPickerLanguage[],
  deviceLanguageCodes: readonly string[],
): VersionPickerLanguage[] {
  const uniqueLanguageIds = new Set(uniqueLanguages.map((language) => language.id))
  const userLanguages = deviceLanguageCodes
    .map((code) => uniqueLanguages.find((language) => language.id === code))
    .filter((language): language is VersionPickerLanguage => language !== undefined)
  const orderedCountryLanguages = countryLanguages.filter((language) =>
    uniqueLanguageIds.has(language.id),
  )
  const combined = [...userLanguages, ...orderedCountryLanguages]
  return [...new Map(combined.map((language) => [language.id, language])).values()]
}
