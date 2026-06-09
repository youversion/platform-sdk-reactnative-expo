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
      ScreenOrientation.lockAsync(lock)
      return () => {
        ScreenOrientation.lockAsync(releaseLock)
      }
    }, [lock, releaseLock]),
  )
}
