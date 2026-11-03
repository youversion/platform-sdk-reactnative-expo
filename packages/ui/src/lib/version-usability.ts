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

/** Structural, so `useBibleVersionAbbreviation`'s result fits without lib importing hooks. */
export type VersionLookup = {
  languageId: string | null
  isLoading: boolean
  error: 'offline' | 'failed' | null
}

/**
 * Whether a surface may load this version's text under the provider's filters.
 * An id refusal never waits on the lookup. A language list waits for the
 * lookup, then refuses a missing or unlisted tag. A failed lookup is not a
 * refusal; it stays retryable.
 */
export type VersionGate = 'open' | 'refused' | 'checking' | 'lookupFailed'

export function versionGate(
  versionId: number,
  filters: InternalVersionFilterProps,
  lookup: VersionLookup,
): VersionGate {
  if (isVersionIdDecidablyUnusable(versionId, filters)) {
    return 'refused'
  }
  if (filters.permittedLanguageTags === undefined) {
    return 'open'
  }
  // The tag in flight can still belong to the previous version.
  if (lookup.isLoading) {
    return 'checking'
  }
  if (lookup.error !== null) {
    return 'lookupFailed'
  }
  return isUsableBibleVersion(
    { id: versionId, languageTag: lookup.languageId ?? undefined },
    filters,
  )
    ? 'open'
    : 'refused'
}

/** Language tags that still have at least one version the provider filters allow. */
export function languageTagsWithUsableVersions(
  versionLanguageTags: ReadonlyMap<number, string>,
  filters: InternalVersionFilterProps,
): ReadonlySet<string> {
  const tags = new Set<string>()
  for (const [id, languageTag] of versionLanguageTags) {
    if (languageTag.length === 0) {
      continue
    }
    if (isUsableBibleVersion({ id, languageTag }, filters)) {
      tags.add(languageTag)
    }
  }
  return tags
}
