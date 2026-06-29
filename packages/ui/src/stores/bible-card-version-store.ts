import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import { BIBLE_CARD_VERSION_PERSIST_KEY } from '../lib/constants'
import { parseStoredVersionId } from '../lib/reader-location'

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

type BibleCardVersionState = {
  versionId: number | null
  setVersionId: (versionId: number) => void
}

type PersistedBibleCardVersionSlice = Partial<Pick<BibleCardVersionState, 'versionId'>>

/**
 * Internal persisted Bible Card version for uncontrolled native Bible cards.
 * Not part of the package public API.
 */
export const useBibleCardVersionStore = create<BibleCardVersionState>()(
  persist(
    (set) => ({
      versionId: null,
      setVersionId: (versionId) => {
        const parsed = parseStoredVersionId(versionId)
        if (parsed === null) return
        set({ versionId: parsed })
      },
    }),
    {
      name: BIBLE_CARD_VERSION_PERSIST_KEY,
      storage: createJSONStorage(() => mmkvStateStorage),
      partialize: (state) => ({
        versionId: state.versionId,
      }),
      merge: (persistedState, currentState) => {
        if (persistedState == null || typeof persistedState !== 'object') {
          return currentState
        }

        const persistedSlice = persistedState as PersistedBibleCardVersionSlice
        const versionId = parseStoredVersionId(persistedSlice.versionId)

        return {
          versionId,
          setVersionId: currentState.setVersionId,
        }
      },
    },
  ),
)

export const bibleCardVersionStoreInitialState: Pick<BibleCardVersionState, 'versionId'> = {
  versionId: null,
}
