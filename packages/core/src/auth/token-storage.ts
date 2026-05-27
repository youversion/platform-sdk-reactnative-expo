import { mmkvStorage, secureStorage } from '../storage'
import { MMKV_AUTH_KEYS, SECURE_STORAGE_KEYS } from './constants'

export type StoredTokens = {
  accessToken: string | null
  refreshToken: string | null
  idToken: string | null
  expiryDate: Date | null
}

// Persist all four together. Pass null for any field to remove it.
// SecureStore writes are async (Keychain access); MMKV writes are sync.
export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await Promise.all([
    writeSecureValue(SECURE_STORAGE_KEYS.idToken, tokens.idToken),
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
  const [accessToken, refreshToken, idToken] = await Promise.all([
    secureStorage.get(SECURE_STORAGE_KEYS.accessToken),
    secureStorage.get(SECURE_STORAGE_KEYS.refreshToken),
    secureStorage.get(SECURE_STORAGE_KEYS.idToken),
  ])

  const expiryISO = mmkvStorage.getString(MMKV_AUTH_KEYS.expiryDateISO)
  return {
    accessToken,
    refreshToken,
    idToken,
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
