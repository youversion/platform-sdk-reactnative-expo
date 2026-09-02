import { createMMKV, type MMKV } from 'react-native-mmkv'
import { z } from 'zod'

import { mmkvStorage } from '../storage/mmkv-storage'

// Native tier of the Bible Content Cache (ADR 0020): one MMKV instance per
// Bible version, ids indexed in `yv-platform` for the Content Sweep.

export const BIBLE_CONTENT_VERSION_IDS_KEY = 'bibleContentVersionIds'

export function bibleContentInstanceId(versionId: number): string {
  return `yv-bible-content-${versionId}`
}

const bibleContentEntrySchema = z.object({
  body: z.string(),
  /** Content Expiry, epoch ms. */
  expiresAt: z.number(),
})

export type BibleContentEntry = z.infer<typeof bibleContentEntrySchema>

const versionIdsSchema = z.array(z.number())

export type BibleContentStore = {
  /** Missing → null. Expired (`expiresAt <= now`) → deleted, null. */
  read(versionId: number, key: string, now: number): BibleContentEntry | null
  write(versionId: number, key: string, entry: BibleContentEntry): void
  /** Ids of every version that has (or had) an instance. */
  listVersionIds(): number[]
  /** Content Sweep (ADR 0020): delete every expired entry across all indexed versions. */
  sweep(now: number): void
}

export type BibleContentStoreDeps = {
  /** Opens (or creates) the MMKV instance for one version. */
  openInstance?: (id: string) => MMKV
}

/** MMKV strings are the I/O boundary: parse and validate in one step, never hand `unknown` on. */
function parseStoredJson<T>(raw: string, schema: z.ZodType<T>): T | null {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return null
  }
  const result = schema.safeParse(json)
  return result.success ? result.data : null
}

function listVersionIds(): number[] {
  const raw = mmkvStorage.getString(BIBLE_CONTENT_VERSION_IDS_KEY)
  if (raw === undefined) return []
  return parseStoredJson(raw, versionIdsSchema) ?? []
}

function rememberVersionId(versionId: number): void {
  const ids = listVersionIds()
  if (ids.includes(versionId)) return
  mmkvStorage.set(BIBLE_CONTENT_VERSION_IDS_KEY, JSON.stringify([...ids, versionId]))
}

export function createBibleContentStore({
  openInstance = (id) => createMMKV({ id }),
}: BibleContentStoreDeps = {}): BibleContentStore {
  const instances = new Map<number, MMKV>()

  function instanceFor(versionId: number): MMKV {
    const existing = instances.get(versionId)
    if (existing !== undefined) return existing
    const instance = openInstance(bibleContentInstanceId(versionId))
    instances.set(versionId, instance)
    return instance
  }

  function readEntry(instance: MMKV, key: string, now: number): BibleContentEntry | null {
    const raw = instance.getString(key)
    if (raw === undefined) return null

    const entry = parseStoredJson(raw, bibleContentEntrySchema)
    if (entry === null || entry.expiresAt <= now) {
      instance.remove(key)
      return null
    }
    return entry
  }

  return {
    read(versionId, key, now) {
      return readEntry(instanceFor(versionId), key, now)
    },
    write(versionId, key, entry) {
      rememberVersionId(versionId)
      instanceFor(versionId).set(key, JSON.stringify(entry))
    },
    listVersionIds,
    sweep(now) {
      for (const versionId of listVersionIds()) {
        const instance = instanceFor(versionId)
        for (const key of instance.getAllKeys()) {
          readEntry(instance, key, now)
        }
      }
    },
  }
}
