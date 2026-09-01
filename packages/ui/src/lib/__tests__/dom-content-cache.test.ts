import type { FetchBibleContent } from '@youversion/platform-react-native-expo-core'
import { ensureDomContentCache, registerBibleContentAction } from '../dom-content-cache'

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
})
