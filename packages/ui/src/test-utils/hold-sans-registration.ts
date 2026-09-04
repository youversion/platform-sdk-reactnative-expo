import * as Font from 'expo-font'

import { bundledSans } from '../theme/use-fonts'

/**
 * Holds `Font.loadAsync(bundledSans)` until `register()` so tests can assert
 * the system-font frame, then the family swap. Matches the same object
 * `useBrandFonts` passes, so a remount or a later serif `loadAsync` cannot
 * steal the hang.
 */
export function holdSansRegistration() {
  const isLoaded = jest.mocked(Font.isLoaded)
  const loadAsync = jest.mocked(Font.loadAsync)
  let registerSans: () => void = () => {}

  isLoaded.mockReturnValue(false)
  loadAsync.mockImplementation((map) => {
    if (map === bundledSans) {
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
