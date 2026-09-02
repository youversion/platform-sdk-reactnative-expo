import { createMMKV, type MMKV } from 'react-native-mmkv'

import { mmkvStorage } from '../../storage/mmkv-storage'
import {
  BIBLE_CONTENT_VERSION_IDS_KEY,
  bibleContentInstanceId,
  createBibleContentStore,
} from '../content-store'

// `react-native-mmkv` is shimmed in jest.setup.js: every `createMMKV` call is
// a fresh in-memory instance, so the store's per-version isolation is real here.

function setup() {
  const opened = new Map<string, MMKV>()
  const store = createBibleContentStore({
    openInstance: (id) => {
      const instance = createMMKV({ id })
      opened.set(id, instance)
      return instance
    },
  })
  return { opened, store }
}

const KEY = 'api.youversion.com/v1/bibles/111/chapters/JHN.1'

beforeEach(() => {
  mmkvStorage.clearAll()
})

describe('bible content store', () => {
  it('reads null when nothing was written', () => {
    const { store } = setup()
    expect(store.read(111, KEY, 1_000)).toBeNull()
  })

  it('round-trips an unexpired entry', () => {
    const { store } = setup()
    store.write(111, KEY, { body: '{"a":1}', expiresAt: 5_000 })
    expect(store.read(111, KEY, 4_999)).toEqual({ body: '{"a":1}', expiresAt: 5_000 })
  })

  it('deletes and misses an entry whose expiresAt is at or before now', () => {
    const { store, opened } = setup()
    store.write(111, KEY, { body: 'x', expiresAt: 5_000 })
    expect(store.read(111, KEY, 5_000)).toBeNull()
    expect(opened.get(bibleContentInstanceId(111))?.contains(KEY)).toBe(false)
  })

  it('opens one instance per version id, named yv-bible-content-<id>', () => {
    const { store, opened } = setup()
    store.write(111, KEY, { body: 'a', expiresAt: 9 })
    store.write(111, `${KEY}.2`, { body: 'b', expiresAt: 9 })
    store.write(3034, KEY, { body: 'c', expiresAt: 9 })
    expect([...opened.keys()]).toEqual(['yv-bible-content-111', 'yv-bible-content-3034'])
  })

  it('keeps entries of different versions apart even under the same key', () => {
    const { store } = setup()
    store.write(111, KEY, { body: 'niv', expiresAt: 9 })
    store.write(3034, KEY, { body: 'kjv', expiresAt: 9 })
    expect(store.read(111, KEY, 1)?.body).toBe('niv')
    expect(store.read(3034, KEY, 1)?.body).toBe('kjv')
  })

  it('records each version id once in yv-platform', () => {
    const { store } = setup()
    store.write(111, KEY, { body: 'a', expiresAt: 9 })
    store.write(111, `${KEY}.2`, { body: 'b', expiresAt: 9 })
    store.write(3034, KEY, { body: 'c', expiresAt: 9 })
    expect(mmkvStorage.getString(BIBLE_CONTENT_VERSION_IDS_KEY)).toBe('[111,3034]')
    expect(store.listVersionIds()).toEqual([111, 3034])
  })

  it('treats a corrupt version id list as empty and rewrites it', () => {
    const { store } = setup()
    mmkvStorage.set(BIBLE_CONTENT_VERSION_IDS_KEY, 'not json')
    expect(store.listVersionIds()).toEqual([])
    store.write(111, KEY, { body: 'a', expiresAt: 9 })
    expect(store.listVersionIds()).toEqual([111])
  })

  it('treats a corrupt entry as a miss and deletes it', () => {
    const { store, opened } = setup()
    store.write(111, KEY, { body: 'a', expiresAt: 9 })
    const instance = opened.get(bibleContentInstanceId(111))
    instance?.set(KEY, '{"body":1}')
    expect(store.read(111, KEY, 0)).toBeNull()
    expect(instance?.contains(KEY)).toBe(false)
  })

  it('sweeps expired and corrupt entries across every indexed version, keeping live ones', () => {
    const { store, opened } = setup()
    store.write(111, KEY, { body: 'expired', expiresAt: 5_000 })
    store.write(111, `${KEY}.2`, { body: 'live', expiresAt: 9_000 })
    store.write(3034, KEY, { body: 'expired', expiresAt: 4_000 })
    opened.get(bibleContentInstanceId(3034))?.set(`${KEY}.2`, 'not json')

    store.sweep(5_000)

    const niv = opened.get(bibleContentInstanceId(111))
    const kjv = opened.get(bibleContentInstanceId(3034))
    expect(niv?.contains(KEY)).toBe(false)
    expect(niv?.contains(`${KEY}.2`)).toBe(true)
    expect(kjv?.getAllKeys()).toEqual([])
  })

  it('sweeps to a no-op when no version was ever written', () => {
    const { store, opened } = setup()
    store.sweep(5_000)
    expect(opened.size).toBe(0)
  })
})
