import { ensureDomLocalStorage } from '../dom-local-storage'

type TestGlobal = { window?: { localStorage: Storage | null } }

describe('ensureDomLocalStorage', () => {
  const g = globalThis as unknown as TestGlobal
  const originalWindow = g.window

  afterEach(() => {
    if (originalWindow === undefined) {
      delete g.window
    } else {
      g.window = originalWindow
    }
  })

  it('installs a working in-memory localStorage when the WebView provides none (Android)', () => {
    g.window = { localStorage: null }

    ensureDomLocalStorage()

    const ls = g.window.localStorage as Storage
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
    const real = { getItem: jest.fn(), setItem: jest.fn() } as unknown as Storage
    g.window = { localStorage: real }

    ensureDomLocalStorage()

    expect(g.window.localStorage).toBe(real)
  })

  it('no-ops outside a DOM context (native screen, window undefined)', () => {
    delete g.window
    expect(() => ensureDomLocalStorage()).not.toThrow()
  })
})
