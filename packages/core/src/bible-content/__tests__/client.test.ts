import { getSdkHeaders } from '../../sdk-version'
import { createBibleContentClient } from '../client'

const PATH = '/v1/bibles/111/chapters/JHN.1'

function setup(timeoutMs?: number) {
  const fetchMock: jest.MockedFunction<typeof fetch> = jest.fn()
  const client = createBibleContentClient({
    appKey: 'app-key-1',
    apiHost: 'api.youversion.com',
    installationId: 'inst-1',
    fetch: fetchMock,
    timeoutMs,
  })
  return { client, fetchMock }
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
    const { client, fetchMock } = setup(500)
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

  it.each(['/v1/languages', '/v1/bibles', '/v1/verse_of_the_days/today'])(
    'throws without fetching for the non-content path %s',
    async (path) => {
      const { client, fetchMock } = setup()

      await expect(client({ path })).rejects.toThrow('Not a Bible content path')
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )
})
