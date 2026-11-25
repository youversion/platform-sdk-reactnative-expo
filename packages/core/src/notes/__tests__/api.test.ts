import { getHttpStatus } from '@youversion/platform-core'

import pkg from '../../../package.json'
import { createNotesApi } from '../api'

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
})

const requestId = '2f8c5d2e-6f6c-4b4f-9b36-8c1b5a17d3f9'
const note = {
  id: 'note-1',
  title: 'Morning reflection',
  content: 'Trust in God.',
  color: '44aa44',
  passage: { version_id: 3034, passage_id: 'JHN.3.16' },
  language_tag: 'en-US',
  tags: ['faith'],
  status: 'private' as const,
  created_dt: '2026-10-23T17:00:00Z',
  updated_dt: null,
}
const wireNote = { ...note, passage: { bible_id: 3034, passage_id: 'JHN.3.16' } }

type NotesBody =
  | typeof wireNote
  | (Omit<typeof wireNote, 'title'> & { title: null })
  | { data: readonly (typeof wireNote)[]; next_page_token: string }

function jsonResponse(body: NotesBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: String(status),
    headers: { 'content-type': 'application/json' },
  })
}

type LastRequest = {
  url: URL
  init: RequestInit
}

function lastRequest(): LastRequest {
  const call = mockFetch.mock.calls[0]
  if (call === undefined) throw new Error('expected fetch to have been called')
  return { url: new URL(String(call[0])), init: call[1] ?? {} }
}

const api = () =>
  createNotesApi({
    appKey: 'appkey',
    apiHost: 'api.example.com',
    installationId: 'inst-1',
  })

describe('createNotesApi', () => {
  it('lists a filtered page with the signed-in token and the React Native stamp', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: [wireNote], next_page_token: 'next' }))

    const result = await api().list('reader', {
      version_id: 3034,
      passage_id: 'JHN.3.16',
      page_size: 2,
    })

    expect(result).toEqual({ data: [note], next_page_token: 'next' })
    const { url, init } = lastRequest()
    expect(url.origin + url.pathname).toBe('https://api.example.com/v1/notes')
    expect(url.searchParams.get('bible_id')).toBe('3034')
    expect(url.searchParams.get('passage_id')).toBe('JHN.3.16')
    expect(url.searchParams.get('page_size')).toBe('2')
    const headers = new Headers(init.headers)
    expect(headers.get('authorization')).toBe('Bearer reader')
    expect(headers.get('x-yvp-app-key')).toBe('appkey')
    expect(headers.get('x-yvp-installation-id')).toBe('inst-1')
    expect(headers.get('x-yvp-sdk')).toBe(`ReactNativeSDK=${pkg.version}-dev`)
  })

  it('treats a 204 list as an empty page', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(api().list('reader')).resolves.toEqual({ data: [], next_page_token: null })
  })

  it('creates, updates, and deletes a note', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(wireNote, 201))
      .mockResolvedValueOnce(jsonResponse({ ...wireNote, title: null }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const notes = api()
    const created = await notes.create('writer', {
      request_id: requestId,
      content: note.content,
      status: 'private',
      color: '44AA44',
    })
    expect(created).toEqual(note)
    expect(JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body))).toEqual({
      request_id: requestId,
      content: note.content,
      status: 'private',
      color: '44aa44',
    })

    const updated = await notes.update('writer', note.id, { title: null })
    expect(updated).toEqual({ ...note, title: null })
    expect(mockFetch.mock.calls[1]?.[1]?.method).toBe('PATCH')
    expect(JSON.parse(String(mockFetch.mock.calls[1]?.[1]?.body))).toEqual({ title: null })

    await expect(notes.delete('writer', note.id)).resolves.toBeUndefined()
    expect(mockFetch.mock.calls[2]?.[1]?.method).toBe('DELETE')
  })

  it('throws 404 after delete', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 404 }))
    await expect(api().get('reader', note.id).catch(getHttpStatus)).resolves.toBe(404)
  })

  it('throws before the request for a missing token or an invalid page size', async () => {
    await expect(api().list('')).rejects.toThrow(
      'Authentication required. Please provide a token or sign in before accessing notes.',
    )
    await expect(api().list('reader', { page_size: 100 })).rejects.toThrow('page_size')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('throws the HTTP status for 401, 422, and 500, and rethrows a network failure', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }))
    await expect(api().get('reader', note.id).catch(getHttpStatus)).resolves.toBe(401)

    mockFetch.mockResolvedValueOnce(new Response(null, { status: 422 }))
    await expect(
      api().update('writer', note.id, { title: 'Later' }).catch(getHttpStatus),
    ).resolves.toBe(422)

    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }))
    await expect(api().get('reader', note.id).catch(getHttpStatus)).resolves.toBe(500)

    mockFetch.mockRejectedValueOnce(new Error('offline'))
    await expect(api().list('reader')).rejects.toThrow('offline')
  })
})
