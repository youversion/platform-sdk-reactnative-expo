import { createMMKV } from 'react-native-mmkv'

import { MMKV_AUTH_KEYS } from '../../auth/constants'
import { getSdkHeaders } from '../../sdk-version'
import { mmkvStorage } from '../../storage/mmkv-storage'
import { createBibleContentClient } from '../client'
import { DEFAULT_CONTENT_LIFETIME_MS } from '../content-lifetime'
import { createBibleContentStore } from '../content-store'

const PATH = '/v1/bibles/111/chapters/JHN.1'
const NOW = 1_000

function setup({ timeoutMs, now = () => NOW }: { timeoutMs?: number; now?: () => number } = {}) {
  const fetchMock: jest.MockedFunction<typeof fetch> = jest.fn()
  const store = createBibleContentStore({ openInstance: (id) => createMMKV({ id }) })
  const client = createBibleContentClient({
    appKey: 'app-key-1',
    apiHost: 'api.youversion.com',
    installationId: 'inst-1',
    fetch: fetchMock,
    timeoutMs,
    store,
    now,
  })
  return { client, fetchMock, store }
}

/** A fetch that never resolves but rejects with its signal's reason on abort. */
function stalledFetch(fetchMock: jest.MockedFunction<typeof fetch>) {
  fetchMock.mockImplementation(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      }),
  )
}

describe('createBibleContentClient', () => {
  beforeEach(() => {
    mmkvStorage.clearAll()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('fetches with exactly the three YVP headers and passes the response through', async () => {
    const { client, fetchMock } = setup()
    fetchMock.mockResolvedValue(
      new Response('{"content":"In the beginning"}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const result = await client({ path: PATH })

    expect(fetchMock).toHaveBeenCalledWith(`https://api.youversion.com${PATH}`, {
      headers: {
        'X-YVP-App-Key': 'app-key-1',
        'X-YVP-Installation-Id': 'inst-1',
        'X-YVP-Sdk': getSdkHeaders()['X-YVP-Sdk'],
      },
      signal: expect.any(AbortSignal),
    })
    expect(result).toEqual({
      status: 200,
      body: '{"content":"In the beginning"}',
      contentType: 'application/json',
    })
  })

  it('returns a non-2xx response as data rather than throwing', async () => {
    const { client, fetchMock } = setup()
    fetchMock.mockResolvedValue(new Response('not found', { status: 404 }))

    const result = await client({ path: PATH })

    expect(result.status).toBe(404)
    expect(result.body).toBe('not found')
  })

  it('propagates a network failure', async () => {
    const { client, fetchMock } = setup()
    fetchMock.mockRejectedValue(new TypeError('Network request failed'))

    await expect(client({ path: PATH })).rejects.toThrow('Network request failed')
  })

  it('accepts a query directly after the version id', async () => {
    const { client, fetchMock } = setup()
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))

    await client({ path: '/v1/bibles/111?fields=abbreviation' })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.youversion.com/v1/bibles/111?fields=abbreviation',
      expect.anything(),
    )
  })

  it('aborts a stalled request at the default 10s timeout', async () => {
    jest.useFakeTimers()
    const { client, fetchMock } = setup()
    stalledFetch(fetchMock)

    const pending = client({ path: PATH })
    jest.advanceTimersByTime(10_000)

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('aborts at a caller-provided timeoutMs', async () => {
    jest.useFakeTimers()
    const { client, fetchMock } = setup({ timeoutMs: 500 })
    stalledFetch(fetchMock)

    const pending = client({ path: PATH })
    jest.advanceTimersByTime(500)

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('does not abort a request that resolves before the timeout', async () => {
    jest.useFakeTimers()
    const { client, fetchMock } = setup()
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))

    const result = await client({ path: PATH })
    jest.advanceTimersByTime(10_000)

    expect(result.status).toBe(200)
    const [, init] = fetchMock.mock.calls[0]!
    expect(init?.signal?.aborted).toBe(false)
  })

  it('serves a repeat request from the store without touching the network', async () => {
    const { client, fetchMock } = setup()
    fetchMock.mockImplementation(async () => new Response('{"content":"In the beginning"}', { status: 200 }))

    await client({ path: PATH })
    const result = await client({ path: PATH })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      status: 200,
      body: '{"content":"In the beginning"}',
      contentType: 'application/json',
    })
  })

  it('writes a 2xx body with the seven-day default when Cache-Control is absent', async () => {
    const { client, fetchMock, store } = setup()
    fetchMock.mockImplementation(async () => new Response('{"a":1}', { status: 200 }))

    await client({ path: PATH })

    expect(store.read(111, `api.youversion.com${PATH}`, NOW)).toEqual({
      body: '{"a":1}',
      expiresAt: NOW + DEFAULT_CONTENT_LIFETIME_MS,
    })
  })

  it('derives the Content Expiry from max-age less Age', async () => {
    const { client, fetchMock, store } = setup()
    fetchMock.mockImplementation(
      async () =>
        new Response('{"a":1}', {
          status: 200,
          headers: { 'cache-control': 'public, max-age=86400', age: '400' },
        }),
    )

    await client({ path: PATH })

    expect(store.read(111, `api.youversion.com${PATH}`, NOW)).toEqual({
      body: '{"a":1}',
      expiresAt: NOW + 86_000_000,
    })
  })

  it.each(['no-store', 'no-cache'])('never writes a response carrying %s', async (directive) => {
    const { client, fetchMock, store } = setup()
    fetchMock.mockImplementation(
      async () =>
        new Response('{"a":1}', { status: 200, headers: { 'cache-control': directive } }),
    )

    await client({ path: PATH })
    await client({ path: PATH })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.read(111, `api.youversion.com${PATH}`, NOW)).toBeNull()
  })

  it('never writes a response whose lifetime clamps to zero', async () => {
    const { client, fetchMock, store } = setup()
    fetchMock.mockImplementation(
      async () =>
        new Response('{"a":1}', {
          status: 200,
          headers: { 'cache-control': 'max-age=300', age: '300' },
        }),
    )

    await client({ path: PATH })

    expect(store.read(111, `api.youversion.com${PATH}`, NOW)).toBeNull()
  })

  it('never writes a non-2xx response', async () => {
    const { client, fetchMock, store } = setup()
    fetchMock.mockImplementation(async () => new Response('not found', { status: 404 }))

    await client({ path: PATH })
    await client({ path: PATH })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.read(111, `api.youversion.com${PATH}`, NOW)).toBeNull()
  })

  it('refetches once the entry expires', async () => {
    let now = NOW
    const { client, fetchMock } = setup({ now: () => now })
    fetchMock.mockImplementation(async () => new Response('{"a":1}', { status: 200 }))

    await client({ path: PATH })
    now = NOW + DEFAULT_CONTENT_LIFETIME_MS
    await client({ path: PATH })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('caches per version and per path', async () => {
    const { client, fetchMock } = setup()
    fetchMock.mockImplementation(async () => new Response('{"a":1}', { status: 200 }))

    await client({ path: PATH })
    await client({ path: '/v1/bibles/111/chapters/JHN.2' })
    await client({ path: '/v1/bibles/3034/chapters/JHN.1' })

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('keeps content and the version-id index through the sign-out purge', async () => {
    const { client, fetchMock, store } = setup()
    fetchMock.mockImplementation(async () => new Response('{"a":1}', { status: 200 }))
    await client({ path: PATH })

    // The keys sign-out removes from the shared store (auth-provider, token-storage).
    for (const key of Object.values(MMKV_AUTH_KEYS)) mmkvStorage.remove(key)

    await client({ path: PATH })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.listVersionIds()).toEqual([111])
  })

  it.each(['/v1/languages', '/v1/bibles', '/v1/verse_of_the_days/today'])(
    'throws without fetching for the non-content path %s',
    async (path) => {
      const { client, fetchMock } = setup()

      await expect(client({ path })).rejects.toThrow('Not a Bible content path')
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )
})
