/**
 * Copied from `@youversion/platform-react-hooks` `useFilteredVersions` so native
 * search and language filtering match the Web SDK picker.
 */
export type FilterableVersion = {
  id: number
  title: string
  abbreviation: string
  languageTag: string
  localizedTitle?: string
}

function isoFromVersion(version: FilterableVersion): string {
  return version.languageTag || 'unknown'
}

function versionSortTitle(version: FilterableVersion): string {
  return version.localizedTitle || version.title
}

function compareVersionsAlphabetically(a: FilterableVersion, b: FilterableVersion): number {
  const byTitle = versionSortTitle(a).localeCompare(versionSortTitle(b), 'en', {
    sensitivity: 'base',
  })
  if (byTitle !== 0) {
    return byTitle
  }
  return a.id - b.id
}

export function filterVersions(
  versions: readonly FilterableVersion[],
  searchTerm: string,
  selectedLanguage: string,
  recentVersionIds: readonly number[] = [],
): FilterableVersion[] {
  let result = [...versions]

  if (selectedLanguage && selectedLanguage !== '*') {
    result = result.filter(
      (version) => isoFromVersion(version).toLowerCase() === selectedLanguage.toLowerCase(),
    )
  }

  if (searchTerm.trim()) {
    const searchLower = searchTerm.toLowerCase()
    result = result.filter(
      (version) =>
        version.title.toLowerCase().includes(searchLower) ||
        version.abbreviation.toLowerCase().includes(searchLower) ||
        isoFromVersion(version).toLowerCase().includes(searchLower),
    )
  }

  if (recentVersionIds.length > 0) {
    result = result.filter((version) => !recentVersionIds.includes(version.id))
  }

  result.sort(compareVersionsAlphabetically)
  return result
}

export type FilterableLanguage = {
  id: string
  language?: string
  displayNames: Readonly<Record<string, string>>
}

/** Copied from `@youversion/platform-react-ui` `filterLanguagesBySearch`. */
export function filterLanguagesBySearch(
  languages: readonly FilterableLanguage[],
  query: string,
): FilterableLanguage[] {
  const trimmedQuery = query.trim().toLowerCase()
  if (!trimmedQuery) {
    return [...languages]
  }

  return languages.filter((language) => {
    if (language.id.toLowerCase().includes(trimmedQuery)) {
      return true
    }
    if (language.language?.toLowerCase().includes(trimmedQuery)) {
      return true
    }
    return Object.values(language.displayNames).some((name) =>
      name.toLowerCase().includes(trimmedQuery),
    )
  })
}
