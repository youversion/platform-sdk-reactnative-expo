/* global jest */
/* eslint-disable react-hooks/rules-of-hooks, react-hooks/exhaustive-deps */
/**
 * Reanimated + @gorhom/bottom-sheet both expect a worklets-enabled native
 * runtime which jest doesn't provide. Each ships an official jest mock; we
 * register them here so tests can render components that pull these in
 * transitively (e.g. `NativeSheet`).
 */

// Provide a minimal nativeModuleProxy so NativeModules.js takes the fast path
// instead of hitting the __fbBatchedBridgeConfig invariant. Each module name
// resolves to a no-op proxy that returns {} for property access and () => {}
// for function calls, plus a getConstants method returning empty dimensions.
if (typeof global.nativeModuleProxy === 'undefined') {
  const DISPLAY_METRICS = {
    windowPhysicalPixels: {
      width: 1170,
      height: 2532,
      scale: 3,
      fontScale: 1,
      densityDpi: 458,
    },
    screenPhysicalPixels: {
      width: 1170,
      height: 2532,
      scale: 3,
      fontScale: 1,
      densityDpi: 458,
    },
  }

  const moduleConstants = {
    DeviceInfo: { Dimensions: DISPLAY_METRICS },
    PlatformConstants: {
      interfaceIdiom: 'phone',
      forceTouchAvailable: false,
      osVersion: '18.0',
      systemName: 'iOS',
      isTesting: true,
    },
  }

  const noopModule = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'getConstants') return () => ({})
        return () => {}
      },
    },
  )

  global.nativeModuleProxy = new Proxy(
    {},
    {
      get(_t, moduleName) {
        if (moduleConstants[moduleName]) {
          return {
            getConstants: () => moduleConstants[moduleName],
          }
        }
        return noopModule
      },
    },
  )
}

if (typeof window !== 'undefined' && typeof window.dispatchEvent !== 'function') {
  window.dispatchEvent = function dispatchEvent() {
    return true
  }
}
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
jest.mock('@gorhom/bottom-sheet', () => require('./jest.gorhom-mock').createGorhomMock())
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: require('./jest.window-dimensions-mock').mockUseWindowDimensions,
}))

/**
 * `react-native-safe-area-context` throws "No safe area value available" when
 * `useSafeAreaInsets` runs without a `<SafeAreaProvider>`. UI tests render
 * native wrappers (e.g. `BibleReader`) directly without one, so the default
 * insets are zero. Tests that need a specific inset wrap with
 * `<SafeAreaProvider initialMetrics>`.
 */
jest.mock('react-native-safe-area-context', () => {
  const React = require('react')
  const defaultInsets = { top: 0, right: 0, bottom: 0, left: 0 }
  const InsetsContext = React.createContext(defaultInsets)

  function SafeAreaProvider({ children, initialMetrics }) {
    const insets = initialMetrics?.insets ?? defaultInsets
    return React.createElement(InsetsContext.Provider, { value: insets }, children)
  }

  return {
    useSafeAreaInsets: () => React.useContext(InsetsContext),
    SafeAreaProvider,
    SafeAreaView: ({ children }) => children,
  }
})

/**
 * `expo/fetch` exports a `FetchResponse` class that extends the global
 * `Response`. Under jest-expo the global isn't a real constructor, so loading
 * the module throws "Super expression must either be null or a function".
 *
 * UI tests pull this in transitively via the core barrel (auth-provider →
 * pkce-flow → expo/fetch). None of the UI tests exercise the network, so a
 * stub keeps the module load-able.
 */
jest.mock('expo/fetch', () => ({
  fetch: jest.fn(() => Promise.reject(new Error('expo/fetch is mocked in UI tests'))),
}))

/**
 * `expo-font` talks to a native module that Jest cannot load. Brand-font tests
 * assert fetch + map shape; loadAsync is a no-op here. Google Font packages
 * `require()` ttf files, which the Jest transformer does not handle.
 */
jest.mock('expo-font', () => ({
  loadAsync: jest.fn(() => Promise.resolve()),
  useFonts: jest.fn(() => [true, null]),
  isLoaded: jest.fn(() => true),
}))

jest.mock('@expo-google-fonts/inter', () => ({
  Inter_400Regular: 400,
  Inter_500Medium: 500,
  Inter_700Bold: 700,
}))

jest.mock('@expo-google-fonts/source-serif-4', () => ({
  SourceSerif4_400Regular: 1400,
  SourceSerif4_400Regular_Italic: 1401,
  SourceSerif4_500Medium: 1500,
  SourceSerif4_500Medium_Italic: 1501,
  SourceSerif4_700Bold: 1700,
  SourceSerif4_700Bold_Italic: 1701,
}))

const untitledSerifFetchPayload = {
  id: 1,
  slug: 'untitled-serif',
  family: 'Untitled Serif',
  variants: [
    {
      weight: 400,
      style: 'normal',
      sources: [
        { format: 'ttf', url: 'https://cdn.youversion.com/test-fixtures/regular.ttf' },
      ],
    },
  ],
}

const previousFetch = global.fetch
global.fetch = jest.fn((input, init) => {
  if (String(input).includes('/v1/fonts/')) {
    return Promise.resolve(
      new Response(JSON.stringify(untitledSerifFetchPayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
  }
  if (typeof previousFetch === 'function') {
    return previousFetch(input, init)
  }
  return Promise.reject(new Error(`unexpected fetch in UI tests: ${String(input)}`))
})

jest.mock('@rn-primitives/portal', () => ({
  Portal: ({ children }) => children,
  PortalHost: () => null,
  PortalProvider: ({ children }) => children,
}))

/**
 * react-native-mmkv v4 ships on top of NitroModules, whose native turbo module
 * isn't available in a plain jest-expo runtime. This shim gives us a
 * deterministic, in-memory MMKV instance plus the React hooks the SDK uses,
 * so the hook + sheet tests can exercise real state transitions without a
 * dev build.
 *
 * Identifiers must be prefixed with `mock` so jest's babel transform allows
 * them inside the mock factory.
 */
jest.mock('react-native-mmkv', () => {
  const { useEffect, useState } = require('react')

  function mockCreateMMKV() {
    const store = new Map()
    const listeners = new Set()
    const notify = (key) => {
      for (const listener of listeners) listener(key)
    }
    return {
      set(key, value) {
        store.set(key, value)
        notify(key)
      },
      getString(key) {
        const value = store.get(key)
        return typeof value === 'string' ? value : undefined
      },
      getNumber(key) {
        const value = store.get(key)
        return typeof value === 'number' ? value : undefined
      },
      getBoolean(key) {
        const value = store.get(key)
        return typeof value === 'boolean' ? value : undefined
      },
      delete(key) {
        store.delete(key)
        notify(key)
      },
      remove(key) {
        const existed = store.has(key)
        this.delete(key)
        return existed
      },
      clearAll() {
        const keys = Array.from(store.keys())
        store.clear()
        for (const key of keys) notify(key)
      },
      trim() {},
      getAllKeys() {
        return Array.from(store.keys())
      },
      contains(key) {
        return store.has(key)
      },
      addOnValueChangedListener(listener) {
        listeners.add(listener)
        return { remove: () => listeners.delete(listener) }
      },
    }
  }

  const mockSharedInstance = mockCreateMMKV()

  function mockUseValue(key, instance, read) {
    const mmkv = instance ?? mockSharedInstance
    const [value, setValue] = useState(() => read(mmkv, key))

    useEffect(() => {
      const subscription = mmkv.addOnValueChangedListener((changedKey) => {
        if (changedKey === key) setValue(read(mmkv, key))
      })
      setValue(read(mmkv, key))
      return () => subscription.remove()
    }, [mmkv, key])

    const setter = (next) => {
      const resolved = typeof next === 'function' ? next(read(mmkv, key)) : next
      if (resolved == null) {
        mmkv.delete(key)
      } else {
        mmkv.set(key, resolved)
      }
    }
    return [value, setter]
  }

  return {
    createMMKV: () => mockCreateMMKV(),
    useMMKVNumber: (key, instance) => mockUseValue(key, instance, (mmkv, k) => mmkv.getNumber(k)),
    useMMKVString: (key, instance) => mockUseValue(key, instance, (mmkv, k) => mmkv.getString(k)),
    useMMKVBoolean: (key, instance) => mockUseValue(key, instance, (mmkv, k) => mmkv.getBoolean(k)),
  }
})
