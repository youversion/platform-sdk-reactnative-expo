/* global jest */
/**
 * Official / native-runtime shims. Jest cannot load Nitro MMKV, expo/fetch's
 * Response subclass, or other native modules. App doubles stay out of this file.
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

jest.mock('expo/fetch', () => ({
  fetch: jest.fn(() => Promise.reject(new Error('expo/fetch is mocked in core tests'))),
}))

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
  getRandomBytesAsync: jest.fn(),
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { BASE64: 'base64' },
}))

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}))

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
  openBrowserAsync: jest.fn(),
  maybeCompleteAuthSession: jest.fn(),
}))

jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
}))
