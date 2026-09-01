// Bible Content Client (ADR 0020): native performs eligible Bible content
// requests with the YVP headers composed in core.
import { getSdkHeaders } from '../sdk-version'

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
}

const CONTENT_PATH = /^\/v1\/bibles\/\d+(\/|$)/

const DEFAULT_TIMEOUT_MS = 10_000

export function createBibleContentClient({
  appKey,
  apiHost,
  installationId,
  fetch: fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: BibleContentClientDeps): FetchBibleContent {
  return async ({ path }) => {
    const [pathname] = path.split('?', 1)
    if (!pathname || !CONTENT_PATH.test(pathname)) {
      throw new Error(`Not a Bible content path: ${path}`)
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
      const body = await response.text()
      return { status: response.status, body, contentType: response.headers.get('content-type') }
    } finally {
      clearTimeout(timer)
    }
  }
}
