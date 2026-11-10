import type { VersionPickerVersion } from '../bible-version-picker-api'
import type { VersionPickerCatalog } from '../version-picker-catalog-cache'
import {
  clearVersionPickerMemoryCache,
  loadCachedLanguageVersions,
  loadCachedVersionPickerCatalog,
} from '../version-picker-catalog-cache'

const emptyCatalog: VersionPickerCatalog = {
  languages: [],
  countryLanguages: [],
  tags: new Map(),
  summaries: [],
}

const englishVersions: readonly VersionPickerVersion[] = [
  {
    id: 111,
    title: 'King James Version',
    localizedTitle: 'King James Version',
    abbreviation: 'KJV',
    localizedAbbreviation: 'KJV',
    languageTag: 'en',
  },
]

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

beforeEach(() => {
  clearVersionPickerMemoryCache()
})

describe('version picker catalog memory cache', () => {
  it('shares one in-flight catalog load across callers', async () => {
    const pending = deferred<VersionPickerCatalog>()
    const load = jest.fn(() => pending.promise)

    const first = loadCachedVersionPickerCatalog('host', 'key', load)
    const second = loadCachedVersionPickerCatalog('host', 'key', load)
    expect(load).toHaveBeenCalledTimes(1)

    pending.resolve(emptyCatalog)
    await expect(first).resolves.toBe(emptyCatalog)
    await expect(second).resolves.toBe(emptyCatalog)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('does not share catalog entries across apiHost or appKey', async () => {
    const loadA = jest.fn(async () => emptyCatalog)
    const loadB = jest.fn(async () => emptyCatalog)

    await loadCachedVersionPickerCatalog('host-a', 'key', loadA)
    await loadCachedVersionPickerCatalog('host-b', 'key', loadB)
    await loadCachedVersionPickerCatalog('host-a', 'other-key', loadB)

    expect(loadA).toHaveBeenCalledTimes(1)
    expect(loadB).toHaveBeenCalledTimes(2)
  })

  it('drops a failed language-versions load so the next call fetches again', async () => {
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error('429'))
      .mockResolvedValueOnce(englishVersions)

    await expect(loadCachedLanguageVersions('host', 'key', 'en', load)).rejects.toThrow('429')
    await expect(loadCachedLanguageVersions('host', 'key', 'en', load)).resolves.toBe(
      englishVersions,
    )
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('does not delete a newer entry when an older failed load settles after clear', async () => {
    let rejectFirst!: (reason: Error) => void
    const firstLoad = new Promise<VersionPickerCatalog>((_resolve, reject) => {
      rejectFirst = reject
    })
    const secondLoad = jest.fn(async () => emptyCatalog)

    const firstPromise = loadCachedVersionPickerCatalog('host', 'key', () => firstLoad)
    clearVersionPickerMemoryCache()
    await loadCachedVersionPickerCatalog('host', 'key', secondLoad)

    rejectFirst(new Error('stale'))
    await expect(firstPromise).rejects.toThrow('stale')

    const thirdLoad = jest.fn(async () => emptyCatalog)
    await loadCachedVersionPickerCatalog('host', 'key', thirdLoad)
    expect(secondLoad).toHaveBeenCalledTimes(1)
    expect(thirdLoad).toHaveBeenCalledTimes(0)
  })
})
