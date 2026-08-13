import { mmkvStorage } from '../storage/mmkv-storage'
import { secureStorage } from '../storage/secure-storage'
import { MMKV_AUTH_KEYS, SECURE_STORAGE_KEYS } from './constants'

export type StoredTokens = {
  accessToken: string | null
  refreshToken: string | null
  idToken: string | null
  expiryDate: Date | null
}

// Pass null for any field to remove it.
// SecureStore writes are async (Keychain access); MMKV writes are sync.
export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await Promise.all([
    writeSecureValue(SECURE_STORAGE_KEYS.accessToken, tokens.accessToken),
    writeSecureValue(SECURE_STORAGE_KEYS.refreshToken, tokens.refreshToken),
    writeSecureValue(SECURE_STORAGE_KEYS.idToken, tokens.idToken),
  ])
  writeExpiry(tokens.expiryDate)
}

// The expiry is a cache over the tokens, which are the record, so a store that
// refuses it cannot fail the save — sign-out awaits this after it has already
// cleared the session. A lost expiry costs one refresh: `refreshToken` reads a
// missing one as already stale.
function writeExpiry(expiryDate: Date | null): void {
  try {
    if (expiryDate) {
      mmkvStorage.set(MMKV_AUTH_KEYS.expiryDateISO, expiryDate.toISOString())
    } else {
      mmkvStorage.remove(MMKV_AUTH_KEYS.expiryDateISO)
    }
  } catch {
    // Cached expiry lost; the tokens are what the session runs on.
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
