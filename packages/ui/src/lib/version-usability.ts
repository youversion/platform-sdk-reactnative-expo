import type { InternalVersionFilterProps } from './version-filter-props'

// Same permit/exclude/language rules as `@youversion/platform-core` version-filters.
// Those functions read `YouVersionPlatformConfiguration`, which this provider
// does not write.

export function isVersionIdDecidablyUnusable(
  versionId: number,
  filters: InternalVersionFilterProps,
): boolean {
  const { excludedVersionIds, permittedVersionIds } = filters
  if (excludedVersionIds?.includes(versionId)) {
    return true
  }
  return permittedVersionIds !== undefined && !permittedVersionIds.includes(versionId)
}

export function isUsableBibleVersion(
  candidate: { id: number; languageTag?: string },
  filters: InternalVersionFilterProps,
): boolean {
  if (isVersionIdDecidablyUnusable(candidate.id, filters)) {
    return false
  }
  const { permittedLanguageTags } = filters
  if (permittedLanguageTags === undefined) {
    return true
  }
  if (candidate.languageTag === undefined) {
    return false
  }
  return permittedLanguageTags.includes(candidate.languageTag)
}
