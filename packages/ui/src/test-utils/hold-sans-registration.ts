import * as Font from 'expo-font'

import { bundledSans } from '../theme/use-fonts'

function isBundledSansMap(map: unknown): boolean {
  if (map === null || typeof map !== 'object') {
    return false
  }
  const keys = Object.keys(map)
  const sansKeys = Object.keys(bundledSans)
  return keys.length === sansKeys.length && sansKeys.every((key) => keys.includes(key))
}

/**
 * Holds `Font.loadAsync(bundledSans)` until `register()` so tests can assert
 * the system-font frame, then the family swap. Matches the sans map by shape
 * so a remount or a later serif `loadAsync` cannot steal the hang.
 */
export function holdSansRegistration(): { register: () => void; restore: () => void } {
  const isLoaded = jest.mocked(Font.isLoaded)
  const loadAsync = jest.mocked(Font.loadAsync)
  let registerSans: () => void = () => {}

  isLoaded.mockReturnValue(false)
  loadAsync.mockImplementation((map) => {
    if (isBundledSansMap(map)) {
      return new Promise<void>((resolve) => {
        registerSans = resolve
      })
    }
    return Promise.resolve()
  })

  return {
    register() {
      registerSans()
    },
    restore() {
      isLoaded.mockReturnValue(true)
      loadAsync.mockImplementation(() => Promise.resolve())
    },
  }
}
