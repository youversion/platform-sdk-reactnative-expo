import { mmkvStorage } from '@youversion/platform-react-native-expo-core'

import { nonBlankQuery } from '../../lib/bible-reader-search'
import {
  BIBLE_CARD_VERSION_PERSIST_KEY,
  READER_LOCATION_PERSIST_KEY,
  READER_SETTINGS_PERSIST_KEY,
  RECENT_BIBLE_VERSIONS_PERSIST_KEY,
  SEARCH_HISTORY_PERSIST_KEY,
} from '../../lib/constants'
import { useBibleCardVersionStore } from '../bible-card-version-store'
import { useReaderLocationStore } from '../reader-location-store'
import { useReaderSettingsStore } from '../reader-settings-store'
import { useRecentBibleVersionsStore } from '../recent-bible-versions-store'
import { useSearchHistoryStore } from '../search-history-store'
import { READER_LINE_SPACING } from '../types/reader-line-spacing'

type PersistedStore = {
  getState: () => object
  persist: { rehydrate: () => Promise<void> | void; clearStorage: () => void }
}

type StoreCase = {
  key: string
  store: PersistedStore
  write: () => void
  written: object
  stored: object
}

function query(text: string) {
  const branded = nonBlankQuery(text)
  if (branded === null) {
    throw new Error(`test fixture query is blank: ${text}`)
  }
  return branded
}

const storeCases: StoreCase[] = [
  {
    key: BIBLE_CARD_VERSION_PERSIST_KEY,
    store: useBibleCardVersionStore,
    write: () => useBibleCardVersionStore.getState().setVersionId(111),
    written: { versionId: 111 },
    stored: { versionId: 59 },
  },
  {
    key: READER_LOCATION_PERSIST_KEY,
    store: useReaderLocationStore,
    write: () =>
      useReaderLocationStore.getState().setLocation({ book: 'JHN', chapter: '3', versionId: 111 }),
    written: { book: 'JHN', chapter: '3', versionId: 111 },
    stored: { book: 'GEN', chapter: '1', versionId: 59 },
  },
  {
    key: READER_SETTINGS_PERSIST_KEY,
    store: useReaderSettingsStore,
    write: () => useReaderSettingsStore.getState().setLineSpacing(READER_LINE_SPACING.LG),
    written: { lineSpacing: READER_LINE_SPACING.LG },
    stored: { lineSpacing: READER_LINE_SPACING.SM },
  },
  {
    key: RECENT_BIBLE_VERSIONS_PERSIST_KEY,
    store: useRecentBibleVersionsStore,
    write: () => useRecentBibleVersionsStore.getState().recordVersionSelection(111),
    written: { versionIds: [111] },
    stored: { versionIds: [3034, 59] },
  },
  {
    key: SEARCH_HISTORY_PERSIST_KEY,
    store: useSearchHistoryStore,
    write: () => useSearchHistoryStore.getState().record(query('love')),
    written: { entries: ['love'] },
    stored: { entries: ['hope', 'faith'] },
  },
]

beforeEach(() => {
  mmkvStorage.clearAll()
})

describe.each(storeCases)('$key', ({ key, store, write, written, stored }) => {
  it('writes the persisted slice to MMKV under its key', () => {
    write()

    const raw = mmkvStorage.getString(key)
    expect(raw).toBeDefined()
    expect(JSON.parse(raw ?? '{}').state).toMatchObject(written)
  })

  it('rehydrates the slice from MMKV', async () => {
    mmkvStorage.set(key, JSON.stringify({ state: stored, version: 0 }))

    await store.persist.rehydrate()

    expect(store.getState()).toMatchObject(stored)
  })

  it('removes the MMKV key when storage is cleared', () => {
    mmkvStorage.set(key, JSON.stringify({ state: stored, version: 0 }))

    store.persist.clearStorage()

    expect(mmkvStorage.getString(key)).toBeUndefined()
  })
})
