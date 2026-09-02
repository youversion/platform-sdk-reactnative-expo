// Bible Content Client (ADR 0020): native performs eligible Bible content
// requests, reading the Content Store before the network and writing storable
// 2xx bodies back with a Content Expiry from the response's Content Lifetime.
import { getSdkHeaders } from '../sdk-version'
import { contentLifetimeMs } from './content-lifetime'
import { createBibleContentStore, type BibleContentStore } from './content-store'

export type BibleContentRequest = { path: string }

export type BibleContentResponse = {
  status: number
  body: string
  contentType: string | null
}

export type FetchBibleContent = (request: BibleContentRequest) => Promise<BibleContentResponse>

type BibleContentClientDeps = {
  appKey: string
  apiHost: string
  installationId: string
  fetch?: typeof globalThis.fetch
  /** Matches the Web SDK ApiClient's 10s, whose signal cannot cross the bridge. */
  timeoutMs?: number
  store?: BibleContentStore
  now?: () => number
}

const CONTENT_PATH = /^\/v1\/bibles\/(\d+)(\/|$)/

const DEFAULT_TIMEOUT_MS = 10_000

export function createBibleContentClient({
  appKey,
  apiHost,
  installationId,
  fetch: fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  store = createBibleContentStore(),
  now = Date.now,
}: BibleContentClientDeps): FetchBibleContent {
  return async ({ path }) => {
    const [pathname] = path.split('?', 1)
    const versionId = pathname === undefined ? null : parseVersionId(pathname)
    if (versionId === null) {
      throw new Error(`Not a Bible content path: ${path}`)
    }

    const key = `${apiHost}${path}`
    const cached = store.read(versionId, key, now())
    if (cached !== null) {
      // Entries keep no content type; stored bodies are always JSON (ADR 0020).
      return { status: 200, body: cached.body, contentType: 'application/json' }
    }

    // RN's OkHttp client ships with no timeouts; without this an Android
    // request on a stalled connection never settles.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(`https://${apiHost}${path}`, {
        headers: {
          'X-YVP-App-Key': appKey,
          'X-YVP-Installation-Id': installationId,
          ...getSdkHeaders(),
        },
        signal: controller.signal,
      })
      // Lifetime counts from header arrival, not body completion (ADR 0020).
      const receivedAt = now()
      const body = await response.text()
      if (response.ok) {
        const lifetimeMs = contentLifetimeMs(
          response.headers.get('cache-control'),
          response.headers.get('age'),
        )
        // null: `no-cache`/`no-store`; 0: already expired — neither is stored (ADR 0020).
        if (lifetimeMs !== null && lifetimeMs > 0) {
          store.write(versionId, key, { body, expiresAt: receivedAt + lifetimeMs })
        }
      }
      return { status: response.status, body, contentType: response.headers.get('content-type') }
    } finally {
      clearTimeout(timer)
    }
  }
}

function parseVersionId(pathname: string): number | null {
  const match = CONTENT_PATH.exec(pathname)
  return match?.[1] === undefined ? null : Number(match[1])
}
