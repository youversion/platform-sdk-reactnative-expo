import { mmkvStorage } from '../storage/mmkv-storage'
import { secureStorage } from '../storage/secure-storage'
import { MMKV_AUTH_KEYS, SECURE_STORAGE_KEYS } from './constants'

export type StoredTokens = {
  accessToken: string | null
  refreshToken: string | null
  expiryDate: Date | null
}

// Pass null for any field to remove it.
// SecureStore writes are async (Keychain access); MMKV writes are sync.
export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await Promise.all([
    writeSecureValue(SECURE_STORAGE_KEYS.accessToken, tokens.accessToken),
    writeSecureValue(SECURE_STORAGE_KEYS.refreshToken, tokens.refreshToken),
  ])
  if (tokens.expiryDate) {
    mmkvStorage.set(MMKV_AUTH_KEYS.expiryDateISO, tokens.expiryDate.toISOString())
  } else {
    mmkvStorage.remove(MMKV_AUTH_KEYS.expiryDateISO)
  }
}

export async function loadTokens(): Promise<StoredTokens> {
  const [accessToken, refreshToken] = await Promise.all([
    secureStorage.get(SECURE_STORAGE_KEYS.accessToken),
    secureStorage.get(SECURE_STORAGE_KEYS.refreshToken),
  ])

  const expiryISO = mmkvStorage.getString(MMKV_AUTH_KEYS.expiryDateISO)
  return {
    accessToken,
    refreshToken,
    expiryDate: expiryISO ? new Date(expiryISO) : null,
  }
}

async function writeSecureValue(key: string, value: string | null): Promise<void> {
  if (value == null) {
    await secureStorage.remove(key)
  } else {
    await secureStorage.set(key, value)
  }
}
