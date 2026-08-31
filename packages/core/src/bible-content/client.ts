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
}

const CONTENT_PATH = /^\/v1\/bibles\/\d+(\/|$)/

export function createBibleContentClient({
  appKey,
  apiHost,
  installationId,
  fetch: fetchImpl = globalThis.fetch,
}: BibleContentClientDeps): FetchBibleContent {
  return async ({ path }) => {
    const [pathname] = path.split('?', 1)
    if (!pathname || !CONTENT_PATH.test(pathname)) {
      throw new Error(`Not a Bible content path: ${path}`)
    }

    const response = await fetchImpl(`https://${apiHost}${path}`, {
      headers: {
        'X-YVP-App-Key': appKey,
        'X-YVP-Installation-Id': installationId,
        ...getSdkHeaders(),
      },
    })
    const body = await response.text()
    return { status: response.status, body, contentType: response.headers.get('content-type') }
  }
}
