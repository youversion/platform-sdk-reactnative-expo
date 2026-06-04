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
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'))

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
 * Core's real `YouVersionProvider` gates children on async `getOrSetInstallationId`,
 * so synchronous `getByTestId` calls after `render(...)` see `fallback` (null)
 * instead of the wrapped component. UI tests verify the native wrapper, not
 * core's loading semantics — swap in a sync passthrough provider backed by a
 * test context. Other exports (`mmkvStorage`, types) keep their real values.
 */
jest.mock('@youversion/platform-react-native-expo-core', () => {
  const React = require('react')
  const actual = jest.requireActual('@youversion/platform-react-native-expo-core')

  const TestContext = React.createContext(null)

  function YouVersionProvider({ appKey, apiHost, children }) {
    const value = React.useMemo(
      () => ({
        appKey,
        apiHost: apiHost ?? 'https://api.youversion.com',
        installationId: 'test-installation-id',
      }),
      [appKey, apiHost],
    )
    return React.createElement(TestContext.Provider, { value }, children)
  }

  function useYouVersion() {
    const ctx = React.useContext(TestContext)
    if (!ctx) {
      throw new Error(
        'YouVersionProvider is required. Wrap your app with <YouVersionProvider appKey="...">.',
      )
    }
    return ctx
  }

  function useYVAuth() {
    return {
      isAuthenticated: false,
      accessToken: null,
      userInfo: null,
      error: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshNow: jest.fn(),
      isLoading: false,
    }
  }

  return {
    ...actual,
    YouVersionProvider,
    useYouVersion,
    useYVAuth,
  }
})

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
