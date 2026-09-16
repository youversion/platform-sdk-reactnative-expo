import { act, renderHook, waitFor } from '@testing-library/react-native'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'

import { youVersionProviderWrapper as wrapper } from '../../test-utils/youversion-provider-wrapper'
import { useBibleVersionAbbreviation } from '../use-bible-version-abbreviation'

const fetchMock = jest.mocked(global.fetch)
const defaultFetchImpl = fetchMock.getMockImplementation()

function urlFromFetchInput(input: RequestInfo | URL): string {
  if (input instanceof Request) {
    return input.url
  }
  if (input instanceof URL) {
    return input.href
  }
  return input
}

function isVersionUrl(url: string): boolean {
  return /\/v1\/bibles\/\d+(?:\?|$)/.test(url)
}

function restoreDefaultFetch() {
  if (defaultFetchImpl) {
    fetchMock.mockImplementation(defaultFetchImpl)
  }
}

function fontResponse() {
  return Promise.resolve(
    new Response(
      JSON.stringify({ id: 1, slug: 'untitled-serif', family: 'Untitled Serif', variants: [] }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    ),
  )
}

function versionResponse(
  abbreviation: string,
  languageTag: string,
  localizedAbbreviation?: string,
) {
  const payload =
    localizedAbbreviation === undefined
      ? { abbreviation, language_tag: languageTag }
      : { abbreviation, localized_abbreviation: localizedAbbreviation, language_tag: languageTag }
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
    }),
  )
}

/** A `/v1/bibles/{id}` body exactly as written, so a test can omit a field the API may omit. */
function versionBodyResponse(payload: {
  abbreviation?: string
  localized_abbreviation?: string
  language_tag?: string
}) {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
    }),
  )
}

describe('useBibleVersionAbbreviation', () => {
  beforeEach(() => {
    mmkvStorage.clearAll()
    fetchMock.mockClear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    restoreDefaultFetch()
  })

  it('returns the abbreviation and language after a successful lookup', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isVersionUrl(url) && url.includes('/111')) {
        return versionResponse('NIV', 'en')
      }
      if (url.includes('/v1/fonts/')) {
        return fontResponse()
      }
      return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
    })

    const { result } = renderHook(() => useBibleVersionAbbreviation(111), { wrapper: wrapper() })

    expect(result.current).toEqual({ abbreviation: null, languageId: null, isLoading: true })
    await waitFor(() => {
      expect(result.current).toEqual({ abbreviation: 'NIV', languageId: 'en', isLoading: false })
    })
  })

  it('keeps the previous short name, with loading true, while the new version fetches', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isVersionUrl(url) && url.includes('/111')) {
        return versionResponse('NIV', 'en')
      }
      if (isVersionUrl(url) && url.includes('/128')) {
        return versionResponse('NIV', 'es', 'NVI')
      }
      if (url.includes('/v1/fonts/')) {
        return fontResponse()
      }
      return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
    })

    const { result, rerender } = renderHook(
      ({ versionId }: { versionId: number }) => useBibleVersionAbbreviation(versionId),
      { wrapper: wrapper(), initialProps: { versionId: 111 } },
    )

    await waitFor(() => {
      expect(result.current.abbreviation).toBe('NIV')
    })

    rerender({ versionId: 128 })
    expect(result.current).toEqual({ abbreviation: 'NIV', languageId: 'en', isLoading: true })
    await waitFor(() => {
      expect(result.current).toEqual({ abbreviation: 'NVI', languageId: 'es', isLoading: false })
    })
  })

  it('drops the previous short name when the new version lookup fails', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isVersionUrl(url) && url.includes('/111')) {
        return versionResponse('NIV', 'en')
      }
      if (url.includes('/v1/fonts/')) {
        return fontResponse()
      }
      return Promise.reject(new Error('network down'))
    })

    const { result, rerender } = renderHook(
      ({ versionId }: { versionId: number }) => useBibleVersionAbbreviation(versionId),
      { wrapper: wrapper(), initialProps: { versionId: 111 } },
    )

    await waitFor(() => {
      expect(result.current.abbreviation).toBe('NIV')
    })

    // Holding NIV here would name version 128 after the one before it, and hand the consumer
    // its language too. Once the lookup settles empty, the caller leaves the pill blank.
    rerender({ versionId: 128 })
    await waitFor(() => {
      expect(result.current).toEqual({ abbreviation: null, languageId: null, isLoading: false })
    })
  })

  it('paints a seen version from cache without a loading flash', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isVersionUrl(url) && url.includes('/111')) {
        return versionResponse('NIV', 'en')
      }
      if (isVersionUrl(url) && url.includes('/128')) {
        return versionResponse('NIV', 'es', 'NVI')
      }
      if (url.includes('/v1/fonts/')) {
        return fontResponse()
      }
      return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
    })

    const { result, rerender } = renderHook(
      ({ versionId }: { versionId: number }) => useBibleVersionAbbreviation(versionId),
      { wrapper: wrapper(), initialProps: { versionId: 111 } },
    )

    await waitFor(() => {
      expect(result.current.abbreviation).toBe('NIV')
    })
    rerender({ versionId: 128 })
    await waitFor(() => {
      expect(result.current.abbreviation).toBe('NVI')
    })

    rerender({ versionId: 111 })
    expect(result.current).toEqual({ abbreviation: 'NIV', languageId: 'en', isLoading: false })
    await waitFor(() => {
      expect(result.current.abbreviation).toBe('NIV')
    })
  })

  it('does not pair a new short name with the last version language', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isVersionUrl(url) && url.includes('/111')) {
        return versionResponse('NIV', 'en')
      }
      if (isVersionUrl(url) && url.includes('/128')) {
        return versionBodyResponse({ abbreviation: 'NVI' })
      }
      if (url.includes('/v1/fonts/')) {
        return fontResponse()
      }
      return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
    })

    const { result, rerender } = renderHook(
      ({ versionId }: { versionId: number }) => useBibleVersionAbbreviation(versionId),
      { wrapper: wrapper(), initialProps: { versionId: 111 } },
    )

    await waitFor(() => {
      expect(result.current.languageId).toBe('en')
    })

    rerender({ versionId: 128 })
    await waitFor(() => {
      expect(result.current).toEqual({ abbreviation: 'NVI', languageId: null, isLoading: false })
    })

    // The cache has to agree with the live lookup: same version, same pair.
    rerender({ versionId: 111 })
    await waitFor(() => {
      expect(result.current.abbreviation).toBe('NIV')
    })
    rerender({ versionId: 128 })
    expect(result.current).toEqual({ abbreviation: 'NVI', languageId: null, isLoading: false })
  })

  it('does not fetch when disabled', () => {
    const { result } = renderHook(() => useBibleVersionAbbreviation(111, { enabled: false }), {
      wrapper: wrapper(),
    })

    expect(result.current).toEqual({ abbreviation: null, languageId: null, isLoading: false })
    expect(fetchMock.mock.calls.some(([input]) => isVersionUrl(urlFromFetchInput(input)))).toBe(
      false,
    )
  })

  it('stays null when the lookup fails', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (url.includes('/v1/fonts/')) {
        return fontResponse()
      }
      return Promise.reject(new Error('network down'))
    })

    const { result } = renderHook(() => useBibleVersionAbbreviation(3034), { wrapper: wrapper() })

    expect(result.current).toEqual({ abbreviation: null, languageId: null, isLoading: true })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current).toEqual({ abbreviation: null, languageId: null, isLoading: false })
  })

  it('refetches when retryKey bumps after a failed lookup', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (url.includes('/v1/fonts/')) {
        return fontResponse()
      }
      return Promise.reject(new Error('network down'))
    })

    const { result, rerender } = renderHook(
      ({ retryKey }: { retryKey: number }) => useBibleVersionAbbreviation(111, { retryKey }),
      { wrapper: wrapper(), initialProps: { retryKey: 0 } },
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.abbreviation).toBeNull()

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isVersionUrl(url) && url.includes('/111')) {
        return versionResponse('NIV', 'en')
      }
      if (url.includes('/v1/fonts/')) {
        return fontResponse()
      }
      return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
    })

    rerender({ retryKey: 1 })
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => {
      expect(result.current).toEqual({ abbreviation: 'NIV', languageId: 'en', isLoading: false })
    })
  })

  it('retries past a cacheable empty version body', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isVersionUrl(url) && url.includes('/111')) {
        return versionBodyResponse({})
      }
      if (url.includes('/v1/fonts/')) {
        return fontResponse()
      }
      return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
    })

    const { result, rerender } = renderHook(
      ({ retryKey }: { retryKey: number }) => useBibleVersionAbbreviation(111, { retryKey }),
      { wrapper: wrapper(), initialProps: { retryKey: 0 } },
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.abbreviation).toBeNull()

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isVersionUrl(url) && url.includes('/111')) {
        return versionResponse('NIV', 'en')
      }
      if (url.includes('/v1/fonts/')) {
        return fontResponse()
      }
      return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
    })

    rerender({ retryKey: 1 })
    await waitFor(() => {
      expect(result.current).toEqual({ abbreviation: 'NIV', languageId: 'en', isLoading: false })
    })
  })

  it('retries past a cacheable empty version body after the effect remounts', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isVersionUrl(url) && url.includes('/111')) {
        return versionBodyResponse({})
      }
      if (url.includes('/v1/fonts/')) {
        return fontResponse()
      }
      return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
    })

    const { result, rerender } = renderHook(
      ({ retryKey, enabled }: { retryKey: number; enabled: boolean }) =>
        useBibleVersionAbbreviation(111, { retryKey, enabled }),
      { wrapper: wrapper(), initialProps: { retryKey: 0, enabled: true } },
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.abbreviation).toBeNull()

    const versionResolvers: Array<(value: Response) => void> = []
    const versionFetches: Promise<Response>[] = []
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isVersionUrl(url) && url.includes('/111')) {
        const pending = new Promise<Response>((resolve) => {
          versionResolvers.push(resolve)
        })
        versionFetches.push(pending)
        return pending
      }
      if (url.includes('/v1/fonts/')) {
        return fontResponse()
      }
      return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
    })

    rerender({ retryKey: 1, enabled: true })
    // Strict Mode remounts the effect with the same retryKey before the retry fetch
    // settles. Skip must stay on for that remount or it rereads the empty 200.
    rerender({ retryKey: 1, enabled: false })
    rerender({ retryKey: 1, enabled: true })

    await act(async () => {
      for (const resolve of versionResolvers) {
        resolve(
          new Response(JSON.stringify({ abbreviation: 'NIV', language_tag: 'en' }), {
            status: 200,
            headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
          }),
        )
      }
      await Promise.all(versionFetches)
    })
    await waitFor(() => {
      expect(result.current).toEqual({ abbreviation: 'NIV', languageId: 'en', isLoading: false })
    })
  })

  it('does not let a cancelled version meta overwrite a newer cache entry', async () => {
    let resolveFirst!: (value: Response) => void
    let resolveSecond!: (value: Response) => void
    const first = new Promise<Response>((resolve) => {
      resolveFirst = resolve
    })
    const second = new Promise<Response>((resolve) => {
      resolveSecond = resolve
    })
    let versionCalls = 0

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isVersionUrl(url) && url.includes('/111')) {
        versionCalls += 1
        if (versionCalls === 1) {
          return first
        }
        return second
      }
      if (isVersionUrl(url) && url.includes('/128')) {
        return versionResponse('NVI', 'es')
      }
      if (url.includes('/v1/fonts/')) {
        return fontResponse()
      }
      return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
    })

    const { result, rerender } = renderHook(
      ({ versionId, retryKey }: { versionId: number; retryKey: number }) =>
        useBibleVersionAbbreviation(versionId, { retryKey }),
      { wrapper: wrapper(), initialProps: { versionId: 111, retryKey: 0 } },
    )

    await waitFor(() => {
      expect(versionCalls).toBe(1)
    })
    rerender({ versionId: 111, retryKey: 1 })
    await waitFor(() => {
      expect(versionCalls).toBe(2)
    })

    await act(async () => {
      resolveSecond(
        new Response(JSON.stringify({ abbreviation: 'NIV', language_tag: 'en' }), {
          status: 200,
          headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
        }),
      )
      await second
    })
    await waitFor(() => {
      expect(result.current.abbreviation).toBe('NIV')
    })

    await act(async () => {
      resolveFirst(
        new Response(JSON.stringify({ abbreviation: 'KJV', language_tag: 'en' }), {
          status: 200,
          headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
        }),
      )
      await first
    })

    rerender({ versionId: 128, retryKey: 1 })
    await waitFor(() => {
      expect(result.current.abbreviation).toBe('NVI')
    })
    rerender({ versionId: 111, retryKey: 1 })
    expect(result.current.abbreviation).toBe('NIV')
  })
})
