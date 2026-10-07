import type { FetchBibleContent } from '@youversion/platform-react-native-expo-core'
import { ensureDomContentCache, registerBibleContentAction } from '../dom-content-cache'

function createRealBibleContentClient(deps: {
  appKey: string
  apiHost: string
  installationId: string
  store: {
    read: () => null
    write: () => void
    listVersionIds: () => number[]
    sweep: () => void
  }
}): FetchBibleContent {
  // Loaded from source so the factory stays off the package namespace.
  // This parameter shape has to track client.ts. typeof import() of that file
  // pulls core sources outside this package's rootDir.
  // SAFETY: client.ts exports createBibleContentClient, and that function returns FetchBibleContent.
  const clientModule = jest.requireActual('../../../../core/src/bible-content/client') as {
    createBibleContentClient: (next: typeof deps) => FetchBibleContent
  }
  return clientModule.createBibleContentClient(deps)
}

const API_HOST = 'api.youversion.com'
const CONTENT_URL = `https://${API_HOST}/v1/bibles/111/chapters/JHN.1?fields=content`

describe('ensureDomContentCache', () => {
  const realFetch = globalThis.fetch
  let passthrough: jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    passthrough = jest.fn()
    globalThis.fetch = passthrough
    ensureDomContentCache()
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  function mockContentResponse() {
    passthrough.mockResolvedValue(
      new Response('{"content":"In the beginning"}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
  }

  it('routes an eligible request through the native action and rebuilds the Response', async () => {
    const action: jest.MockedFunction<FetchBibleContent> = jest.fn()
    action.mockResolvedValue({
      status: 200,
      body: '{"content":"In the beginning"}',
      contentType: 'application/json',
    })
    registerBibleContentAction({ apiHost: API_HOST, fetchBibleContent: action })

    const response = await globalThis.fetch(CONTENT_URL)

    expect(action).toHaveBeenCalledWith({ path: '/v1/bibles/111/chapters/JHN.1?fields=content' })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    await expect(response.text()).resolves.toBe('{"content":"In the beginning"}')
    expect(passthrough).not.toHaveBeenCalled()
  })

  it.each([
    ['an explicit default port', `${API_HOST}:443`],
    ['uppercase', 'API.YouVersion.COM'],
  ])(
    'still intercepts when the registered apiHost carries %s (ADR 0020: no WebView bypass)',
    async (_label, apiHost) => {
      const action: jest.MockedFunction<FetchBibleContent> = jest.fn()
      action.mockResolvedValue({ status: 200, body: '{}', contentType: 'application/json' })
      registerBibleContentAction({ apiHost, fetchBibleContent: action })

      const response = await globalThis.fetch(CONTENT_URL)

      expect(response.status).toBe(200)
      expect(action).toHaveBeenCalledWith({ path: '/v1/bibles/111/chapters/JHN.1?fields=content' })
      expect(passthrough).not.toHaveBeenCalled()
    },
  )

  it('matches a non-default port only when both sides carry it', async () => {
    const action: jest.MockedFunction<FetchBibleContent> = jest.fn()
    action.mockResolvedValue({ status: 200, body: '{}', contentType: 'application/json' })
    registerBibleContentAction({ apiHost: `${API_HOST}:8443`, fetchBibleContent: action })
    passthrough.mockResolvedValue(new Response('from network'))

    await globalThis.fetch(`https://${API_HOST}:8443/v1/bibles/111/chapters/JHN.1`)
    expect(action).toHaveBeenCalledTimes(1)

    await globalThis.fetch(CONTENT_URL)
    expect(action).toHaveBeenCalledTimes(1)
    expect(passthrough).toHaveBeenCalledWith(CONTENT_URL, undefined)
  })

  it.each([
    ['a POST to a content path', CONTENT_URL, { method: 'POST' }],
    ['another host', 'https://other.example.com/v1/bibles/111/chapters/JHN.1', undefined],
    ['the versions list', `https://${API_HOST}/v1/bibles`, undefined],
    ['verse of the day', `https://${API_HOST}/v1/verse_of_the_days/today`, undefined],
    ['highlights', `https://${API_HOST}/v1/users/1/highlights`, undefined],
  ])('passes %s to the real fetch untouched', async (_label, url, init) => {
    const action: jest.MockedFunction<FetchBibleContent> = jest.fn()
    registerBibleContentAction({ apiHost: API_HOST, fetchBibleContent: action })
    passthrough.mockResolvedValue(new Response('from network'))

    const response = await globalThis.fetch(url, init)

    expect(passthrough).toHaveBeenCalledWith(url, init)
    expect(action).not.toHaveBeenCalled()
    await expect(response.text()).resolves.toBe('from network')
  })

  it('rejects with the abort reason without calling the native action when already aborted', async () => {
    const action: jest.MockedFunction<FetchBibleContent> = jest.fn()
    registerBibleContentAction({ apiHost: API_HOST, fetchBibleContent: action })
    const reason = new Error('caller gone')
    const controller = new AbortController()
    controller.abort(reason)

    await expect(globalThis.fetch(CONTENT_URL, { signal: controller.signal })).rejects.toBe(reason)
    expect(action).not.toHaveBeenCalled()
  })

  it('rejects with the abort reason, not a TypeError, when the signal aborts mid-flight', async () => {
    const action: jest.MockedFunction<FetchBibleContent> = jest.fn()
    action.mockReturnValue(new Promise(() => {}))
    registerBibleContentAction({ apiHost: API_HOST, fetchBibleContent: action })
    const controller = new AbortController()

    const pending = globalThis.fetch(CONTENT_URL, { signal: controller.signal })
    const reason = new Error('timed out')
    controller.abort(reason)

    await expect(pending).rejects.toBe(reason)
  })

  it('resolves through the native action when a signal is present but never aborts', async () => {
    const action: jest.MockedFunction<FetchBibleContent> = jest.fn()
    action.mockResolvedValue({ status: 200, body: '{}', contentType: 'application/json' })
    registerBibleContentAction({ apiHost: API_HOST, fetchBibleContent: action })
    const controller = new AbortController()

    const response = await globalThis.fetch(CONTENT_URL, { signal: controller.signal })

    expect(response.status).toBe(200)
  })

  it('rejects with a TypeError when the native action throws, without falling back', async () => {
    const action: jest.MockedFunction<FetchBibleContent> = jest.fn()
    action.mockRejectedValue(new Error('bridge died'))
    registerBibleContentAction({ apiHost: API_HOST, fetchBibleContent: action })

    await expect(globalThis.fetch(CONTENT_URL)).rejects.toBeInstanceOf(TypeError)
    expect(passthrough).not.toHaveBeenCalled()
  })

  it('rejects with a TypeError when no action is registered for an eligible request', async () => {
    registerBibleContentAction({ apiHost: API_HOST })

    await expect(globalThis.fetch(CONTENT_URL)).rejects.toBeInstanceOf(TypeError)
    expect(passthrough).not.toHaveBeenCalled()
  })

  it('wraps fetch exactly once', () => {
    const woven = globalThis.fetch

    ensureDomContentCache()

    expect(globalThis.fetch).toBe(woven)
  })

  it('lets the native action call global fetch without re-entering the wrapper', async () => {
    mockContentResponse()
    const action: FetchBibleContent = async ({ path }) => {
      const response = await globalThis.fetch(`https://${API_HOST}${path}`)
      return {
        status: response.status,
        body: await response.text(),
        contentType: response.headers.get('content-type'),
      }
    }
    registerBibleContentAction({ apiHost: API_HOST, fetchBibleContent: action })

    const response = await globalThis.fetch(CONTENT_URL)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    await expect(response.text()).resolves.toBe('{"content":"In the beginning"}')
    expect(passthrough).toHaveBeenCalledTimes(1)
    expect(passthrough).toHaveBeenCalledWith(CONTENT_URL, undefined)
  })

  it('lets the real Bible content client reach the network once', async () => {
    mockContentResponse()
    const fetchBibleContent = createRealBibleContentClient({
      appKey: 'app-key',
      apiHost: API_HOST,
      installationId: 'inst-1',
      store: {
        read: () => null,
        write: () => {},
        listVersionIds: () => [],
        sweep: () => {},
      },
    })
    registerBibleContentAction({ apiHost: API_HOST, fetchBibleContent })

    const response = await globalThis.fetch(CONTENT_URL)

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe('{"content":"In the beginning"}')
    expect(passthrough).toHaveBeenCalledTimes(1)
    const [url] = passthrough.mock.calls[0] ?? []
    expect(url).toBe(CONTENT_URL)
  })

  it('lets the real Bible content client reach the network once when called outside the wrapper', async () => {
    mockContentResponse()
    const fetchBibleContent = createRealBibleContentClient({
      appKey: 'app-key',
      apiHost: API_HOST,
      installationId: 'inst-1',
      store: {
        read: () => null,
        write: () => {},
        listVersionIds: () => [],
        sweep: () => {},
      },
    })
    registerBibleContentAction({ apiHost: API_HOST, fetchBibleContent })

    const result = await fetchBibleContent({
      path: '/v1/bibles/111/chapters/JHN.1?fields=content',
    })

    expect(result).toEqual({
      status: 200,
      body: '{"content":"In the beginning"}',
      contentType: 'application/json',
    })
    expect(passthrough).toHaveBeenCalledTimes(1)
    const [url] = passthrough.mock.calls[0] ?? []
    expect(url).toBe(CONTENT_URL)
  })

  it('routes a second eligible request through the native action while the first is in flight', async () => {
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const action: jest.MockedFunction<FetchBibleContent> = jest.fn()
    action.mockImplementation(async () => {
      await gate
      return { status: 200, body: '{"content":"verse"}', contentType: 'application/json' }
    })
    registerBibleContentAction({ apiHost: API_HOST, fetchBibleContent: action })

    const first = globalThis.fetch(CONTENT_URL)
    const second = globalThis.fetch(
      `https://${API_HOST}/v1/bibles/111/chapters/JHN.2?fields=content`,
    )
    release()
    const responses = await Promise.all([first, second])

    expect(action).toHaveBeenCalledTimes(2)
    expect(action).toHaveBeenNthCalledWith(1, {
      path: '/v1/bibles/111/chapters/JHN.1?fields=content',
    })
    expect(action).toHaveBeenNthCalledWith(2, {
      path: '/v1/bibles/111/chapters/JHN.2?fields=content',
    })
    expect(passthrough).not.toHaveBeenCalled()
    await expect(responses[0]?.text()).resolves.toBe('{"content":"verse"}')
    await expect(responses[1]?.text()).resolves.toBe('{"content":"verse"}')
  })
})
