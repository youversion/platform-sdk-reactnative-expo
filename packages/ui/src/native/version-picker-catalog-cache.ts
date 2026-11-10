import type { VersionPickerLanguage, VersionPickerVersion } from './bible-version-picker-api'

export type VersionPickerCatalog = {
  languages: readonly VersionPickerLanguage[]
  countryLanguages: readonly VersionPickerLanguage[]
  tags: ReadonlyMap<number, string>
  summaries: readonly VersionPickerVersion[]
}

const catalogPromises = new Map<string, Promise<VersionPickerCatalog>>()
const languageVersionPromises = new Map<string, Promise<readonly VersionPickerVersion[]>>()

function remember<T>(
  store: Map<string, Promise<T>>,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const cached = store.get(key)
  if (cached !== undefined) {
    return cached
  }

  const stored = load().then(
    (value) => value,
    (error) => {
      if (store.get(key) === stored) {
        store.delete(key)
      }
      throw error
    },
  )
  store.set(key, stored)
  return stored
}

// Suggested languages are requested for country "zz". The device locale only
// reorders that result on the client, so it is not part of the key.
export function loadCachedVersionPickerCatalog(
  apiHost: string,
  appKey: string,
  load: () => Promise<VersionPickerCatalog>,
): Promise<VersionPickerCatalog> {
  return remember(catalogPromises, JSON.stringify([apiHost, appKey]), load)
}

export function loadCachedLanguageVersions(
  apiHost: string,
  appKey: string,
  languageId: string,
  load: () => Promise<readonly VersionPickerVersion[]>,
): Promise<readonly VersionPickerVersion[]> {
  return remember(languageVersionPromises, JSON.stringify([apiHost, appKey, languageId]), load)
}

export function clearVersionPickerMemoryCache(): void {
  catalogPromises.clear()
  languageVersionPromises.clear()
}
