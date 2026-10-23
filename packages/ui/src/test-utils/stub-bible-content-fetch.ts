const VERSE_HTML =
  '<div><div class="p">' +
  '<span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>In the beginning' +
  '<span class="yv-n f"><span class="ft">Or At first</span></span>' +
  '<span class="yv-v" v="16"></span><span class="yv-vlbl">16</span>For God so loved' +
  '</div></div>'

type StubOptions = {
  html?: string
  /** Status for `/passages/` requests. Other Bible requests stay 200. */
  passageStatus?: number
  /** Reject `/passages/` requests so the embed reports offline. */
  failPassage?: boolean
}

export type BibleContentFetchStub = {
  urls: string[]
  appKeys: string[]
  html: string
  passageStatus: number
  failPassage: boolean
  restore: () => void
}

/**
 * Intercept Bible content requests. The provider captures `fetch` at mount, so
 * later tests change `passageStatus` and `failPassage` on the returned object.
 * Font and other fetches keep the previous `fetch`.
 */
export function installBibleContentFetch(options: StubOptions = {}): BibleContentFetchStub {
  const state: BibleContentFetchStub = {
    urls: [],
    appKeys: [],
    html: options.html ?? VERSE_HTML,
    passageStatus: options.passageStatus ?? 200,
    failPassage: options.failPassage ?? false,
    restore: () => {
      globalThis.fetch = previous
    },
  }
  const previous = globalThis.fetch
  // SAFETY: the stub returns the Response members the content client reads (ok, status, headers, text).
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input)
    if (!url.includes('/v1/bibles/')) {
      return previous(input, init)
    }
    state.urls.push(url)
    const header = new Headers(init?.headers).get('X-YVP-App-Key')
    if (header !== null) {
      state.appKeys.push(header)
    }
    if (state.failPassage && url.includes('/passages/')) {
      throw new TypeError('Network request failed')
    }
    const status = url.includes('/passages/') ? state.passageStatus : 200
    const body = url.includes('/passages/')
      ? JSON.stringify({ content: state.html, reference: 'John 3' })
      : JSON.stringify({ abbreviation: 'NIV', language_tag: 'en' })
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => 'no-store' },
      text: async () => body,
    }
  }) as typeof fetch
  return state
}

function requestUrl(input: RequestInfo | URL): string {
  if (input instanceof URL) {
    return input.href
  }
  if (input instanceof Request) {
    return input.url
  }
  return input
}
