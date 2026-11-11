import { mmkvStorage } from '@youversion/platform-react-native-expo-core'

/** MMKV-backed storage for zustand `persist` (sync; hydrates at store creation). */
export const mmkvStateStorage = {
  getItem: (name: string): string | null => mmkvStorage.getString(name) ?? null,
  setItem: (name: string, value: string): void => {
    mmkvStorage.set(name, value)
  },
  removeItem: (name: string): void => {
    mmkvStorage.remove(name)
  },
}
