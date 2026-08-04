import { BIBLE_READER_FONT, clampBibleReaderFontSize } from '@youversion/platform-react-ui'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import { READER_SETTINGS_PERSIST_KEY } from '../lib/constants'
import { SOURCE_SERIF_FONT, UNTITLED_SERIF_FONT, type FontFamily } from '../lib/reader-fonts'
import { READER_LINE_SPACING } from './types/reader-line-spacing'

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

type ReaderSettingsState = {
  fontSize: number
  fontFamily: FontFamily
  lineSpacing: number
  setFontSize: (size: number) => void
  setFontFamily: (fontFamily: FontFamily) => void
  setLineSpacing: (size: number) => void
}

type PersistedReaderSlice = Partial<
  Pick<ReaderSettingsState, 'fontSize' | 'fontFamily' | 'lineSpacing'>
>

/**
 * Line spacing cycles through a fixed set of values (see `changeBibleReaderLineSpacing`),
 * so an arbitrary or stale persisted number is coerced back to the default rather than clamped.
 */
const normalizeLineSpacing = (value: number | undefined): number =>
  Object.values(READER_LINE_SPACING).some((spacing) => spacing === value)
    ? (value as number)
    : READER_LINE_SPACING.DEFAULT

/**
 * Web SDK 2.5.0 replaced the Source Serif stack with Untitled Serif and migrates
 * the old value on load — but only when `fontFamily` is uncontrolled. We always
 * pass it controlled, so that migration never runs for us and we do it here
 * instead. Without it the picker matches neither font button and shows no
 * active state.
 */
const normalizeFontFamily = (value: FontFamily): FontFamily =>
  value === SOURCE_SERIF_FONT ? UNTITLED_SERIF_FONT : value

/**
 * Internal persisted reader settings for the native Bible reader.
 * Not part of the package public API.
 */
export const useReaderSettingsStore = create<ReaderSettingsState>()(
  persist(
    (set) => ({
      fontSize: BIBLE_READER_FONT.DEFAULT,
      fontFamily: UNTITLED_SERIF_FONT,
      lineSpacing: READER_LINE_SPACING.DEFAULT,
      setFontSize: (size) => set({ fontSize: clampBibleReaderFontSize(size) }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setLineSpacing: (size) => set({ lineSpacing: normalizeLineSpacing(size) }),
    }),
    {
      name: READER_SETTINGS_PERSIST_KEY,
      storage: createJSONStorage(() => mmkvStateStorage),
      partialize: (state) => ({
        fontSize: state.fontSize,
        fontFamily: state.fontFamily,
        lineSpacing: state.lineSpacing,
      }),
      merge: (persistedState, currentState) => {
        if (persistedState == null || typeof persistedState !== 'object') {
          return currentState
        }

        // Zustand types merge's first arg as `unknown` (PersistOptions), so TS can't infer persistedState.
        const persistedReaderSlice = persistedState as PersistedReaderSlice
        return {
          fontSize: clampBibleReaderFontSize(
            persistedReaderSlice.fontSize ?? currentState.fontSize,
          ),
          fontFamily: normalizeFontFamily(
            persistedReaderSlice.fontFamily ?? currentState.fontFamily,
          ),
          lineSpacing: normalizeLineSpacing(
            persistedReaderSlice.lineSpacing ?? currentState.lineSpacing,
          ),
          setFontSize: currentState.setFontSize,
          setFontFamily: currentState.setFontFamily,
          setLineSpacing: currentState.setLineSpacing,
        }
      },
    },
  ),
)
