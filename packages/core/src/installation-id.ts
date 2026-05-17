import { MMKV_KEYS } from '@/auth/constants'
import { mmkvStorage } from '@/storage'
import * as Application from 'expo-application'
import * as Crypto from 'expo-crypto'
import { Platform } from 'react-native'

// Returns a stable installation identifier for this app on this device.
export async function getOrSetInstallationId(): Promise<string> {
  const stored = mmkvStorage.getString(MMKV_KEYS.installationId)

  if (stored) {
    return stored
  }

  const fresh = await readDeviceId()
  mmkvStorage.set(MMKV_KEYS.installationId, fresh)
  return fresh
}

async function readDeviceId(): Promise<string> {
  if (Platform.OS == 'ios') {
    const idfv = await Application.getIosIdForVendorAsync()
    if (idfv) {
      return idfv
    }
  } else if (Platform.OS == 'android') {
    const androidId = Application.getAndroidId()
    if (androidId) {
      return androidId
    }
  }

  // Edge cases: IDFV can be null on a newly-restored iOS device or before unlock;
  // ANDROID_ID can be empty on rare custom builds. Fall back to a random UUID;
  // it persists in MMKV like a normal ID so we stay stable from then on.
  return Crypto.randomUUID()
}
