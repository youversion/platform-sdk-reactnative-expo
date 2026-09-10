import { renderHook, waitFor } from '@testing-library/react-native'
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
    new Response(JSON.stringify({ id: 1, slug: 'untitled-serif', family: 'Untitled Serif', variants: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

function versionResponse(abbreviation: string, languageTag: string, localizedAbbreviation?: string) {
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
})
