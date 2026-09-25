import { z } from 'zod'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import { MAX_RECENT_BIBLE_VERSIONS, RECENT_BIBLE_VERSIONS_PERSIST_KEY } from '../lib/constants'

const mmkvStateStorage = {
  getItem: (name: string): string | null => mmkvStorage.getString(name) ?? null,
  setItem: (name: string, value: string): void => {
    mmkvStorage.set(name, value)
  },
  removeItem: (name: string): void => {
    mmkvStorage.remove(name)
  },
}

type RecentBibleVersionsState = {
  versionIds: number[]
  recordVersionSelection: (versionId: number) => void
}

const persistedRecentVersionsSchema = z.object({
  versionIds: z.array(z.number()).optional(),
})

export const useRecentBibleVersionsStore = create<RecentBibleVersionsState>()(
  persist(
    (set, get) => ({
      versionIds: [],
      recordVersionSelection: (versionId) => {
        if (!Number.isFinite(versionId)) {
          return
        }
        const filtered = get().versionIds.filter((id) => id !== versionId)
        const updated = [versionId, ...filtered].slice(0, MAX_RECENT_BIBLE_VERSIONS)
        set({ versionIds: updated })
      },
    }),
    {
      name: RECENT_BIBLE_VERSIONS_PERSIST_KEY,
      storage: createJSONStorage(() => mmkvStateStorage),
      partialize: (state) => ({
        versionIds: state.versionIds,
      }),
      merge: (persistedState, currentState) => {
        const persistedSlice = persistedRecentVersionsSchema.safeParse(persistedState)
        if (!persistedSlice.success) {
          return currentState
        }
        const versionIds = (persistedSlice.data.versionIds ?? []).filter((id) =>
          Number.isFinite(id),
        )
        return {
          versionIds,
          recordVersionSelection: currentState.recordVersionSelection,
        }
      },
    },
  ),
)

export const recentBibleVersionsStoreInitialState: Pick<RecentBibleVersionsState, 'versionIds'> = {
  versionIds: [],
}
