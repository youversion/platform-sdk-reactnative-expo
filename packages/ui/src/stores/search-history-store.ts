import { z } from 'zod'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import { nonBlankQuery, type NonBlankQuery } from '../lib/bible-reader-search'
import { SEARCH_HISTORY_MAX, SEARCH_HISTORY_PERSIST_KEY } from '../lib/constants'

/** MMKV-backed storage for zustand `persist` (sync; hydrates at store creation). */
const mmkvStateStorage = {
  getItem: (name: string): string | null => mmkvStorage.getString(name) ?? null,
  setItem: (name: string, value: string): void => {
    mmkvStorage.set(name, value)
  },
  removeItem: (name: string): void => {
    mmkvStorage.remove(name)
  },
}

type SearchHistoryState = {
  /** Most recent first, capped, already branded. */
  entries: readonly NonBlankQuery[]
  /** Recorded on submit, including a chip tap, so history does not depend on the network outcome. */
  record: (query: NonBlankQuery) => void
}

const persistedSearchHistorySchema = z.object({
  entries: z.array(z.unknown()).optional(),
})

function capped(entries: readonly NonBlankQuery[]): readonly NonBlankQuery[] {
  const kept: NonBlankQuery[] = []
  const taken = new Set<string>()
  for (const entry of entries) {
    const key = entry.toLowerCase()
    if (taken.has(key)) {
      continue
    }
    taken.add(key)
    kept.push(entry)
    if (kept.length === SEARCH_HISTORY_MAX) {
      break
    }
  }
  return kept
}

function parseStoredEntries(raw: readonly unknown[]): readonly NonBlankQuery[] {
  const parsed: NonBlankQuery[] = []
  for (const value of raw) {
    const asString = z.string().safeParse(value)
    if (!asString.success) {
      continue
    }
    const query = nonBlankQuery(asString.data)
    if (query !== null) {
      parsed.push(query)
    }
  }
  return capped(parsed)
}

/**
 * Internal persisted Reader Search history.
 * Not part of the package public API.
 */
export const useSearchHistoryStore = create<SearchHistoryState>()(
  persist(
    (set, get) => ({
      entries: [],
      record: (query) => {
        const { entries } = get()
        if (entries[0] === query) {
          return
        }
        set({ entries: capped([query, ...entries]) })
      },
    }),
    {
      name: SEARCH_HISTORY_PERSIST_KEY,
      storage: createJSONStorage(() => mmkvStateStorage),
      partialize: (state) => ({ entries: state.entries }),
      merge: (persistedState, currentState) => {
        const parsed = persistedSearchHistorySchema.safeParse(persistedState)
        if (!parsed.success) {
          return currentState
        }

        return {
          entries: parseStoredEntries(parsed.data.entries ?? []),
          record: currentState.record,
        }
      },
    },
  ),
)

export const searchHistoryStoreInitialState: Pick<SearchHistoryState, 'entries'> = {
  entries: [],
}
