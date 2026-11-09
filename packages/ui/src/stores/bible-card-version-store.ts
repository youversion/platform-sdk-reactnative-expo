import { z } from 'zod'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { BIBLE_CARD_VERSION_PERSIST_KEY } from '../lib/constants'
import { parseStoredVersionId } from '../lib/reader-location'
import { mmkvStateStorage } from './mmkv-state-storage'

type BibleCardVersionState = {
  versionId: number | null
  setVersionId: (versionId: number) => void
}

const persistedBibleCardVersionSchema = z.object({
  versionId: z.number().nullable().optional(),
})

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
        const persistedSlice = persistedBibleCardVersionSchema.safeParse(persistedState)
        if (!persistedSlice.success) {
          return currentState
        }

        return {
          versionId: parseStoredVersionId(persistedSlice.data.versionId ?? 0),
          setVersionId: currentState.setVersionId,
        }
      },
    },
  ),
)

export const bibleCardVersionStoreInitialState: Pick<BibleCardVersionState, 'versionId'> = {
  versionId: null,
}
