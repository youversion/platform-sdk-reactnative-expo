// INTERIM (YPE-6577): replaced by @youversion/platform-core once platform-sdk-react#488 ships. Delete this file when adopting it.
// Mirrors ApiClient.getWithStatus in packages/core/src/client.ts @ c748d1f942bc9089ea2f466b4fdc973687794487.
// RN: platform-core 2.17's ApiClient has no getWithStatus, so playlist 204 and a JSON "" stay distinct.

import type { ApiClient } from '@youversion/platform-core'
import * as z from 'zod/mini'

import { object } from './object'

type QueryValue = string | number | boolean | ReadonlyArray<string | number | boolean>

export type StatusQuery = {
  'fields[]'?: readonly string[]
  page_size?: number | '*'
  page_token?: string
}

type StatusHeaders = {
  'Accept-Language'?: string
}

export type StatusResponse<Data> = Readonly<{
  data: Data
  emptyBody: boolean
  status: number
}>

const ErrorBodySchema = object({
  message: z.optional(z.string()),
  error: z.optional(z.string()),
})

function queryString(params?: StatusQuery): string {
  if (!params) return ''
  const searchParams = new URLSearchParams()
  const entries: Array<[string, QueryValue | undefined]> = [
    ['fields[]', params['fields[]']],
    ['page_size', params.page_size],
    ['page_token', params.page_token],
  ]
  for (const [key, value] of entries) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, String(item))
      }
    } else {
      searchParams.append(key, String(value))
    }
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

function requestHeaders(client: ApiClient, extra?: StatusHeaders): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-YVP-App-Key': client.config.appKey,
    'X-YVP-Installation-Id': client.config.installationId || 'web-sdk-default',
  })
  const additional = client.config.additionalHeaders
  if (additional !== undefined) {
    for (const [key, value] of Object.entries(additional)) {
      headers.set(key, value)
    }
  }
  if (extra !== undefined) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) headers.set(key, value)
    }
  }
  return headers
}

/**
 * GET that keeps the success status and whether the body was empty.
 * Matches #488: a JSON `""` is not an empty body; a 204 or blank body is.
 */
export async function getWithStatus<Data>(
  client: ApiClient,
  path: string,
  params?: StatusQuery,
  headers?: StatusHeaders,
): Promise<StatusResponse<Data>> {
  const host = client.config.apiHost || 'api.youversion.com'
  const timeout = client.config.timeout ?? 10_000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(`https://${host}${path}${queryString(params)}`, {
      method: 'GET',
      signal: controller.signal,
      headers: requestHeaders(client, headers),
    })
    clearTimeout(timeoutId)
    if (!response.ok) {
      throw await httpError(response)
    }
    return readSuccess<Data>(response)
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`)
    }
    throw error
  }
}

async function httpError(response: Response): Promise<Error> {
  const isDevelopment = process.env.NODE_ENV === 'development'
  let errorMessage = `HTTP error! status: ${response.status}`
  try {
    const errorBody = await response.text()
    if (errorBody) {
      try {
        const errorJson = ErrorBodySchema.safeParse(JSON.parse(errorBody))
        const detailedMessage = errorJson.success
          ? errorJson.data.message || errorJson.data.error || errorBody
          : errorBody
        if (isDevelopment) {
          errorMessage = detailedMessage
        } else {
          errorMessage = `Request failed with status ${response.status}`
        }
      } catch {
        if (isDevelopment) {
          errorMessage = errorBody
        }
      }
    }
  } catch (error) {
    if (isDevelopment && error instanceof Error) {
      console.error('Failed to read error response:', error.message)
    }
  }
  return Object.assign(new Error(errorMessage), {
    status: response.status,
    statusText: response.statusText,
  })
}

async function readSuccess<Data>(response: Response): Promise<StatusResponse<Data>> {
  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    const text = await response.text()
    if (!text) {
      // SAFETY: empty 2xx JSON bodies are undefined for the caller-owned Data.
      return { data: undefined as Data, emptyBody: true, status: response.status }
    }
    // SAFETY: this helper only decodes JSON text. Callers parse Data with Zod.
    return { data: JSON.parse(text) as Data, emptyBody: false, status: response.status }
  }
  const text = await response.text()
  // SAFETY: non-JSON 2xx bodies are raw text. Callers that need Data parse it.
  return { data: text as Data, emptyBody: text.length === 0, status: response.status }
}
