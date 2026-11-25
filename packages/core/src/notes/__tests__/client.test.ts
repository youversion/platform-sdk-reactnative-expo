import { ApiClient, getHttpStatus } from '@youversion/platform-core'
import type { Note } from '../interim/note-schema'
import { NotesClient } from '../interim/notes-client'

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
})

const apiHost = 'notes.example.test'
const collectionUrl = `https://${apiHost}/v1/notes`
const noteId = 'note/1%'
const requestId = '2f8c5d2e-6f6c-4b4f-9b36-8c1b5a17d3f9'
const passageId = 'JHN.3.16+JHN.3.18'
const note = {
  id: noteId,
  title: 'Morning reflection',
  content: 'Trust in God.',
  color: '44aa44',
  passage: { version_id: 3034, passage_id: passageId },
  language_tag: 'en-US',
  tags: ['faith', 'hope'],
  status: 'private',
  created_dt: '2026-10-23T17:00:00Z',
  updated_dt: null,
} satisfies Note
const wireNote = { ...note, passage: { bible_id: 3034, passage_id: passageId } }

function createClient(): NotesClient {
  return new NotesClient(new ApiClient({ apiHost, appKey: 'test-key' }))
}

type FixtureBody = {
  id?: string
  title?: string | null
  content?: string
  color?: string | null
  passage?: { bible_id?: number; passage_id?: string } | null
  language_tag?: string | null
  tags?: string[] | null
  status?: string
  created_dt?: string
  updated_dt?: string | null
  data?: FixtureBody[]
  next_page_token?: string | null
}

function jsonResponse(body: FixtureBody | string, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: String(status),
    headers: { 'content-type': 'application/json' },
  })
}

function requestUrl(input: RequestInfo | URL): URL {
  if (input instanceof URL) return input
  if (input instanceof Request) return new URL(input.url)
  return new URL(input)
}

describe('NotesClient', () => {
  it('follows a cursor from an empty filtered page and handles both forms of terminal page', async () => {
    const client = createClient()
    const cursor = 'next+/='
    const filters = { version_id: 3034, passage_id: passageId, page_size: 2 }
    const color = '44AA44'
    mockFetch.mockImplementation(async (input, init) => {
      const url = requestUrl(input)
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer reader')
      expect(new Headers(init?.headers).get('x-yvp-app-key')).toBe('test-key')
      const query = Object.fromEntries(url.searchParams)
      if (Object.keys(query).length === 0) return new Response(null, { status: 204 })
      const expectedFilters = { bible_id: '3034', passage_id: passageId, page_size: '2' }
      if (!('page_token' in query)) {
        expect(query).toEqual(expectedFilters)
        return jsonResponse({ data: [], next_page_token: cursor })
      }
      expect(query).toEqual({ ...expectedFilters, page_token: cursor })
      return jsonResponse({ data: [{ ...wireNote, color }] })
    })

    const first = await client.getNotes(filters, 'reader')
    expect(first).toEqual({ data: [], next_page_token: cursor })
    const last = await client.getNotes({ ...filters, page_token: first.next_page_token }, 'reader')
    expect(last).toEqual({ data: [{ ...note, color }], next_page_token: null })
    expect(await client.getNotes(undefined, 'reader')).toEqual({ data: [], next_page_token: null })
  })

  it.each([
    ['no body', () => new Response(null)],
    ['no JSON body', () => new Response(null, { headers: { 'Content-Type': 'application/json' } })],
    ['a JSON empty string', () => jsonResponse('')],
  ])('rejects a 200 Notes page with %s instead of ending pagination', async (_label, respond) => {
    mockFetch.mockImplementation(async () => respond())
    await expect(createClient().getNotes({ page_token: 'next' }, 'reader')).rejects.toThrow(
      'invalid_type',
    )
  })

  it('creates, retries the same request id, gets, partially updates, and deletes a note', async () => {
    const client = createClient()
    const create = {
      request_id: requestId,
      title: note.title,
      content: note.content,
      color: '44AA44',
      passage: note.passage,
      language_tag: note.language_tag,
      tags: note.tags,
      status: note.status,
    }
    const update = { title: null, color: null, passage: null, language_tag: null, tags: null }
    let stored:
      | (Omit<typeof wireNote, keyof typeof update> & {
          [K in keyof typeof update]: (typeof wireNote)[K] | null
        })
      | undefined
    const createBodies: unknown[] = []
    mockFetch.mockImplementation(async (input, init) => {
      const url = requestUrl(input)
      const method = init?.method ?? 'GET'
      const authorization = new Headers(init?.headers).get('authorization')
      if (method === 'POST' && url.href === collectionUrl) {
        expect(authorization).toBe('Bearer writer')
        const json: unknown = JSON.parse(String(init?.body))
        createBodies.push(json)
        expect(json).toEqual({
          ...create,
          color: note.color,
          passage: wireNote.passage,
        })
        stored = { ...wireNote, color: create.color }
        return jsonResponse(stored, 201)
      }
      if (method === 'GET' && url.href === `${collectionUrl}/note%2F1%25`) {
        expect(authorization).toBe('Bearer reader')
        return stored ? jsonResponse(stored) : new Response(null, { status: 404 })
      }
      if (method === 'PATCH' && url.href === `${collectionUrl}/note%2F1%25`) {
        expect(authorization).toBe('Bearer writer')
        const fields = stored?.color === create.color ? { color: note.color } : update
        expect(JSON.parse(String(init?.body))).toEqual(fields)
        stored = { ...wireNote, ...fields }
        return jsonResponse(stored)
      }
      if (method === 'DELETE' && url.href === `${collectionUrl}/note%2F1%25`) {
        expect(authorization).toBe('Bearer writer')
        stored = undefined
        return new Response(null, { status: 204 })
      }
      throw new Error(`unexpected ${method} ${url.href}`)
    })

    const created = await client.createNote(create, 'writer')
    expect(created).toEqual({ ...note, color: create.color })
    const retried = await client.createNote(create, 'writer')
    expect(retried).toEqual(created)
    expect(createBodies).toHaveLength(2)
    expect(createBodies[0]).toEqual(createBodies[1])
    const read = await client.getNote(created.id, 'reader')
    expect(read).toEqual(created)
    expect(await client.updateNote(read.id, { color: read.color }, 'writer')).toEqual(note)
    const updated = await client.updateNote(created.id, update, 'writer')
    expect(updated).toEqual({ ...note, ...update })
    expect(await client.getNote(updated.id, 'reader')).toEqual(updated)
    expect(await client.deleteNote(updated.id, 'writer')).toBeUndefined()
    await expect(client.getNote(updated.id, 'reader').catch(getHttpStatus)).resolves.toBe(404)
  })

  it('rejects invalid writes, pagination, and missing auth before sending a request', async () => {
    const client = createClient()
    mockFetch.mockImplementation(async () => new Response(null, { status: 500 }))

    await expect(client.getNotes()).rejects.toThrow('Authentication required')
    await expect(client.getNotes({ page_size: 100 }, 'reader')).rejects.toThrow('page_size')
    await expect(client.getNotes({ version_id: -1 }, 'reader')).rejects.toThrow('version_id')
    await expect(
      client.updateNote(noteId, { passage: { version_id: 0, passage_id: passageId } }, 'writer'),
    ).rejects.toThrow('version_id')
    await expect(client.updateNote(noteId, { color: '#44AA44' }, 'writer')).rejects.toThrow('color')
    await expect(
      client.createNote({ request_id: 'not-a-uuid', content: 'Note', status: 'private' }, 'writer'),
    ).rejects.toThrow('request_id')
    await expect(client.updateNote(noteId, { title: undefined }, 'writer')).rejects.toThrow(
      'At least one note field is required',
    )
    const passage = { ...note.passage, unexpected: 'field' }
    await expect(client.updateNote(noteId, { passage }, 'writer')).rejects.toThrow('unexpected')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects dot-segment note IDs before making a request', async () => {
    const client = createClient()
    mockFetch.mockImplementation(async () => new Response(null, { status: 500 }))

    await Promise.all([
      expect(client.getNote('.', 'reader')).rejects.toThrow('Note ID'),
      expect(client.deleteNote('..', 'writer')).rejects.toThrow('Note ID'),
    ])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it.each([
    ['status', 'draft'],
    ['color', '#44AA44'],
  ])('rejects an invalid %s in a note response', async (field, value) => {
    mockFetch.mockResolvedValue(jsonResponse({ ...wireNote, [field]: value }))
    await expect(createClient().getNote(noteId, 'reader')).rejects.toThrow(field)
  })

  it('keeps the HTTP status on a failed list and times out a stalled list', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: 'nope' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    )
    await expect(createClient().getNotes({}, 'reader').catch(getHttpStatus)).resolves.toBe(500)

    mockFetch.mockImplementation((_input, init) => {
      return new Promise((_resolve, reject) => {
        const abort = () => {
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        }
        if (init?.signal?.aborted) {
          abort()
          return
        }
        init?.signal?.addEventListener('abort', abort)
      })
    })
    const slow = new NotesClient(new ApiClient({ apiHost, appKey: 'test-key', timeout: 5 }))
    await expect(slow.getNotes({}, 'reader')).rejects.toThrow('Request timeout after 5ms')
  })

  it('preserves lowercase RFC 3339 timestamps but still rejects invalid dates', async () => {
    const client = createClient()
    const timestamps = {
      created_dt: '2026-10-23t17:00:00z',
      updated_dt: '2026-10-24t19:30:00+02:00',
    }
    mockFetch.mockResolvedValue(jsonResponse({ ...wireNote, ...timestamps }))
    expect(await client.getNote(noteId, 'reader')).toEqual({ ...note, ...timestamps })

    mockFetch.mockResolvedValue(jsonResponse({ ...wireNote, updated_dt: '2026-02-30t17:00:00z' }))
    await expect(client.getNote(noteId, 'reader')).rejects.toThrow('updated_dt')
  })
})
