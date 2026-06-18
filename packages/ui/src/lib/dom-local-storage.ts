/**
 * Android's DOM WebView (`@expo/dom-webview`) never sets
 * `WebSettings.domStorageEnabled`, which defaults to `false` on Android. With
 * DOM storage disabled, `window.localStorage` evaluates to **`null`** (not
 * `undefined`). The Web SDK's `YouVersionProvider` and our own `applySDKConfig`
 * both call `localStorage.getItem`/`setItem`, so on Android they throw
 * `Cannot read properties of null (reading 'getItem')`, the DOM error boundary
 * catches it, and the entire component renders blank.
 *
 * iOS (WKWebView) enables DOM storage by default, and `react-native-webview`
 * defaults `domStorageEnabled` to `true` — so this only regressed when Expo
 * SDK 56 made `@expo/dom-webview` the default backing WebView. `@expo/dom-webview`
 * exposes no prop to enable DOM storage, so we cannot flip it from JS.
 *
 * The DOM environment is contractually expected to provide `localStorage`
 * (see AGENTS.md / "Expo DOM Components"). When the platform's `localStorage`
 * is null we install an in-memory `Storage` shim so unmodified Web SDK code
 * keeps working. The shim is per-WebView and not persisted across cold starts;
 * DOM WebViews are long-lived (pre-warmed, not destroyed) and the installation
 * id is supplied from native props on every mount, so the only loss is
 * cross-launch cache — acceptable versus a blank render.
 *
 * Long-term fix is upstream: `@expo/dom-webview` should enable
 * `domStorageEnabled` so the platform provides a real, persistent `localStorage`.
 */

function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null
    },
    removeItem(key: string) {
      map.delete(key)
    },
    setItem(key: string, value: string) {
      map.set(String(key), String(value))
    },
  }
}

/**
 * Installs an in-memory `localStorage` shim on `window` when the host WebView
 * does not provide one (`window.localStorage == null`). Idempotent and safe to
 * call from any DOM component on every render — once a shim (or a real
 * `localStorage`) is present, subsequent calls are a no-op. No-ops outside a
 * DOM/browser context (e.g. native screen tests where `window` is undefined).
 */
export function ensureDomLocalStorage(): void {
  if (typeof window === 'undefined') {
    return
  }

  // Reading `localStorage` can itself throw in some sandboxed contexts; treat a
  // throw the same as "missing" and install the shim.
  let current: Storage | null = null
  try {
    current = window.localStorage
  } catch {
    current = null
  }
  if (current != null) {
    return
  }

  // `localStorage` is a getter-only accessor on `Window.prototype`, so it can't
  // be assigned directly — define an own property on the instance to shadow it.
  Object.defineProperty(window, 'localStorage', {
    value: createMemoryStorage(),
    configurable: true,
    writable: false,
  })
}

// Self-install on import so the shim is in place before any Web SDK code runs.
ensureDomLocalStorage()
