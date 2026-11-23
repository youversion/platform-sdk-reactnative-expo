// INTERIM (YPE-6786): replaced by @youversion/platform-core once platform-sdk-react#497 ships. Delete this file when adopting it.
// Mirrors ApiClient.getWithStatus and ApiClient.patch in packages/core/src/client.ts @ 10dd292a71aaf8fac5fe07aa46d5ff7c98a99b87.
// RN: platform-core 2.17 has no getWithStatus or patch, and its JSON type omits null.

import type { ApiClient } from '@youversion/platform-core'
import * as z from 'zod/mini'

import { object } from './object'

export type NotesQuery = {
  bible_id?: number
  passage_id?: string
  page_size?: number
  page_token?: string
}

type AuthHeaders = {
  Authorization: string
}

export type NotePassageWire = {
  bible_id: number
  passage_id: string
}

/** Wire body for create and update. `null` clears a nullable field. */
export type NoteWriteBody = {
  request_id?: string
  title?: string | null
  content?: string
  color?: string | null
  passage?: NotePassageWire | null
  language_tag?: string | null
  tags?: readonly string[] | null
  status?: 'private' | 'public'
}

export type StatusResponse<Data> = Readonly<{
  data: Data
  status: number
}>

const ErrorBodySchema = object({
  message: z.optional(z.string()),
  error: z.optional(z.string()),
})

function queryString(params?: NotesQuery): string {
  if (!params) return ''
  const searchParams = new URLSearchParams()
  if (params.bible_id !== undefined) searchParams.append('bible_id', String(params.bible_id))
  if (params.passage_id !== undefined) searchParams.append('passage_id', params.passage_id)
  if (params.page_size !== undefined) searchParams.append('page_size', String(params.page_size))
  if (params.page_token !== undefined) searchParams.append('page_token', params.page_token)
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

function requestHeaders(client: ApiClient, extra?: AuthHeaders): Headers {
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
    headers.set('Authorization', extra.Authorization)
  }
  return headers
}

function timeoutMs(client: ApiClient): number {
  return client.config.timeout ?? 10_000
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
      return { data: undefined as Data, status: response.status }
    }
    // SAFETY: this helper only decodes JSON text. Callers parse Data with Zod.
    return { data: JSON.parse(text) as Data, status: response.status }
  }
  const text = await response.text()
  // SAFETY: non-JSON 2xx bodies are raw text. Callers that need Data parse it.
  return { data: text as Data, status: response.status }
}

async function request<Data>(
  client: ApiClient,
  url: string,
  init: RequestInit,
): Promise<StatusResponse<Data>> {
  const timeout = timeoutMs(client)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: init.headers,
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

/**
 * GET that keeps the success status next to the decoded body.
 * A 204 is empty. A JSON `""` is not.
 */
export async function getWithStatus<Data>(
  client: ApiClient,
  path: string,
  params?: NotesQuery,
  headers?: AuthHeaders,
): Promise<StatusResponse<Data>> {
  const host = client.config.apiHost || 'api.youversion.com'
  return request<Data>(client, `https://${host}${path}${queryString(params)}`, {
    method: 'GET',
    headers: requestHeaders(client, headers),
  })
}

/** POST or PATCH with a JSON body. `null` fields are sent, not dropped. */
export async function sendJson<Data>(
  client: ApiClient,
  method: 'POST' | 'PATCH',
  path: string,
  body: NoteWriteBody,
  headers: AuthHeaders,
): Promise<Data> {
  const host = client.config.apiHost || 'api.youversion.com'
  const response = await request<Data>(client, `https://${host}${path}`, {
    method,
    body: JSON.stringify(body),
    headers: requestHeaders(client, headers),
  })
  return response.data
}
