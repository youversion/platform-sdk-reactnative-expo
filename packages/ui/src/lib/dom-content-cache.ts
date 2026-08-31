// Weaves the native Bible Content Client (ADR 0020) under the DOM's fetch:
// eligible Bible content requests cross the bridge; everything else passes
// through to the real fetch untouched.
import type { FetchBibleContent } from '@youversion/platform-react-native-expo-core'

type BibleContentRegistration = {
  apiHost: string
  fetchBibleContent?: FetchBibleContent
}

let registration: BibleContentRegistration | null = null

/** Called by DOM components on render; the latest registration wins. */
export function registerBibleContentAction(next: BibleContentRegistration): void {
  registration = next
}

const CONTENT_PATH = /^\/v1\/bibles\/\d+(\/|$)/

// Response's constructor throws when these statuses carry a body.
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304])

const woven = new WeakSet<typeof globalThis.fetch>()

export function ensureDomContentCache(): void {
  const passthrough = globalThis.fetch
  if (!passthrough || woven.has(passthrough)) return

  const wrappedFetch: typeof globalThis.fetch = async (input, init) => {
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
    let url: URL
    try {
      url = new URL(input instanceof Request ? input.url : String(input))
    } catch {
      return passthrough(input, init)
    }

    const active = registration
    if (
      method.toUpperCase() !== 'GET' ||
      active === null ||
      url.host !== active.apiHost ||
      !CONTENT_PATH.test(url.pathname)
    ) {
      return passthrough(input, init)
    }

    const { fetchBibleContent } = active
    if (!fetchBibleContent) {
      throw new TypeError(`No native Bible content action registered for ${url.pathname}`)
    }

    try {
      const { status, body, contentType } = await fetchBibleContent({
        path: url.pathname + url.search,
      })
      return new Response(NULL_BODY_STATUSES.has(status) ? null : body, {
        status,
        headers: contentType === null ? undefined : { 'content-type': contentType },
      })
    } catch (error) {
      // ADR 0020: a native failure is a network error — no WebView fallback.
      throw new TypeError('Native Bible content request failed', { cause: error })
    }
  }

  woven.add(wrappedFetch)
  globalThis.fetch = wrappedFetch
}
