import { ensureDomLocalStorage } from '../dom-local-storage'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key: string) {
      return map.get(key) ?? null
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null
    },
    removeItem(key: string) {
      map.delete(key)
    },
    setItem(key: string, value: string) {
      map.set(key, value)
    },
  }
}

type WindowStub = {
  localStorage?: Storage | null
}

function setWindow(value: WindowStub | undefined): void {
  Object.defineProperty(globalThis, 'window', {
    value,
    configurable: true,
    writable: true,
  })
}

describe('ensureDomLocalStorage', () => {
  const originalWindow = globalThis.window

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    })
  })

  it('installs a working in-memory localStorage when the WebView provides none (Android)', () => {
    setWindow({ localStorage: null })

    ensureDomLocalStorage()

    const ls = globalThis.window.localStorage
    expect(ls).not.toBeNull()

    ls.setItem('x-yvp-installation-id', 'install-1')
    expect(ls.getItem('x-yvp-installation-id')).toBe('install-1')
    expect(ls.length).toBe(1)
    expect(ls.key(0)).toBe('x-yvp-installation-id')

    ls.removeItem('x-yvp-installation-id')
    expect(ls.getItem('x-yvp-installation-id')).toBeNull()
    expect(ls.length).toBe(0)
    expect(ls.getItem('missing')).toBeNull()
  })

  it('leaves a real localStorage untouched (iOS / react-native-webview)', () => {
    const real = memoryStorage()
    setWindow({ localStorage: real })

    ensureDomLocalStorage()

    expect(globalThis.window.localStorage).toBe(real)
  })

  it('no-ops outside a DOM context (native screen, window undefined)', () => {
    setWindow(undefined)
    expect(() => ensureDomLocalStorage()).not.toThrow()
  })

  it('installs a working memory shim when reading localStorage throws', () => {
    const host: WindowStub = {}
    Object.defineProperty(host, 'localStorage', {
      get() {
        throw new Error('SecurityError')
      },
      configurable: true,
    })
    setWindow(host)

    ensureDomLocalStorage()

    const ls = globalThis.window.localStorage
    expect(ls).not.toBeNull()
    ls.setItem('x-yvp-installation-id', 'install-1')
    expect(ls.getItem('x-yvp-installation-id')).toBe('install-1')
  })
})
