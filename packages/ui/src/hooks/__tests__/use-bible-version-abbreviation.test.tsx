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

    expect(result.current).toEqual({ abbreviation: null, languageId: null })
    await waitFor(() => {
      expect(result.current).toEqual({ abbreviation: 'NIV', languageId: 'en' })
    })
  })

  it('clears the previous short name as soon as the version changes', async () => {
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
    expect(result.current).toEqual({ abbreviation: null, languageId: null })
    await waitFor(() => {
      expect(result.current).toEqual({ abbreviation: 'NVI', languageId: 'es' })
    })
  })

  it('does not fetch when disabled', () => {
    const { result } = renderHook(() => useBibleVersionAbbreviation(111, { enabled: false }), {
      wrapper: wrapper(),
    })

    expect(result.current).toEqual({ abbreviation: null, languageId: null })
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

    expect(result.current).toEqual({ abbreviation: null, languageId: null })
    await waitFor(() => {
      const fetchedVersion = fetchMock.mock.calls.some(([input]) =>
        isVersionUrl(urlFromFetchInput(input)),
      )
      expect(fetchedVersion).toBe(true)
    })
    expect(result.current).toEqual({ abbreviation: null, languageId: null })
  })
})
