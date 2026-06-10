import * as ScreenOrientation from 'expo-screen-orientation'
import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'

/**
 * Locks device orientation while the screen is focused, and restores
 * `releaseLock` when the screen blurs (defaults to the same lock).
 */
export function useLockOrientation(
  lock: ScreenOrientation.OrientationLock,
  releaseLock: ScreenOrientation.OrientationLock = lock,
) {
  useFocusEffect(
    useCallback(() => {
      // Fire-and-forget: lockAsync can reject on platforms that don't support
      // orientation locking, so surface failures instead of swallowing them.
      // Cleanup must stay synchronous, so the release lock chains .catch() too.
      ScreenOrientation.lockAsync(lock).catch(console.error)
      return () => {
        ScreenOrientation.lockAsync(releaseLock).catch(console.error)
      }
    }, [lock, releaseLock]),
  )
}
