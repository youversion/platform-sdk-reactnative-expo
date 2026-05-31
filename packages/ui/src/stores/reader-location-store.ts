import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import { READER_LOCATION_PERSIST_KEY } from '../lib/constants'
import {
  parseStoredBook,
  parseStoredChapter,
  parseStoredLocation,
  parseStoredVersionId,
} from '../lib/reader-location'

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

type ReaderLocationPatch = {
  book?: string
  chapter?: string
  versionId?: number
}

type ReaderLocationState = {
  book: string | null
  chapter: string | null
  versionId: number | null
  setLocation: (patch: ReaderLocationPatch) => void
}

type PersistedReaderLocationSlice = Partial<
  Pick<ReaderLocationState, 'book' | 'chapter' | 'versionId'>
>

/**
 * Internal persisted Reader Location for the native Bible reader.
 * Not part of the package public API.
 */
export const useReaderLocationStore = create<ReaderLocationState>()(
  persist(
    (set) => ({
      book: null,
      chapter: null,
      versionId: null,
      setLocation: (patch) => {
        const next: Partial<Pick<ReaderLocationState, 'book' | 'chapter' | 'versionId'>> = {}

        if (patch.book !== undefined) {
          const parsed = parseStoredBook(patch.book)
          if (parsed != null) next.book = parsed
        }
        if (patch.chapter !== undefined) {
          const parsed = parseStoredChapter(patch.chapter)
          if (parsed != null) next.chapter = parsed
        }
        if (patch.versionId !== undefined) {
          const parsed = parseStoredVersionId(patch.versionId)
          if (parsed != null) next.versionId = parsed
        }

        if (Object.keys(next).length === 0) return
        set(next)
      },
    }),
    {
      name: READER_LOCATION_PERSIST_KEY,
      storage: createJSONStorage(() => mmkvStateStorage),
      partialize: (state) => ({
        book: state.book,
        chapter: state.chapter,
        versionId: state.versionId,
      }),
      merge: (persistedState, currentState) => {
        if (persistedState == null || typeof persistedState !== 'object') {
          return currentState
        }

        const persistedSlice = persistedState as PersistedReaderLocationSlice
        const parsed = parseStoredLocation(persistedSlice)

        return {
          book: parsed.book,
          chapter: parsed.chapter,
          versionId: parsed.versionId,
          setLocation: currentState.setLocation,
        }
      },
    },
  ),
)

export const readerLocationStoreInitialState: Pick<
  ReaderLocationState,
  'book' | 'chapter' | 'versionId'
> = {
  book: null,
  chapter: null,
  versionId: null,
}
