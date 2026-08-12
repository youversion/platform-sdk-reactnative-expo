import * as Crypto from 'expo-crypto'
import { MMKV_KEYS } from './constants'
import { mmkvStorage } from './storage/mmkv-storage'

// Returns a stable installation identifier for this app install.
// Uses a random UUID (not a device identifier) so kids' apps stay COPPA-safe.
export async function getOrSetInstallationId(): Promise<string> {
  const stored = mmkvStorage.getString(MMKV_KEYS.installationId)

  if (stored) {
    return stored
  }

  const fresh = Crypto.randomUUID()
  mmkvStorage.set(MMKV_KEYS.installationId, fresh)
  return fresh
}
