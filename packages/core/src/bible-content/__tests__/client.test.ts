import { getSdkHeaders } from '../../sdk-version'
import { createBibleContentClient } from '../client'

const PATH = '/v1/bibles/111/chapters/JHN.1'

function setup() {
  const fetchMock: jest.MockedFunction<typeof fetch> = jest.fn()
  const client = createBibleContentClient({
    appKey: 'app-key-1',
    apiHost: 'api.youversion.com',
    installationId: 'inst-1',
    fetch: fetchMock,
  })
  return { client, fetchMock }
}

describe('createBibleContentClient', () => {
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

  it.each(['/v1/languages', '/v1/bibles', '/v1/verse_of_the_days/today'])(
    'throws without fetching for the non-content path %s',
    async (path) => {
      const { client, fetchMock } = setup()

      await expect(client({ path })).rejects.toThrow('Not a Bible content path')
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )
})
