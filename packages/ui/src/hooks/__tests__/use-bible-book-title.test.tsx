import { renderHook, waitFor } from '@testing-library/react-native'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'

import { youVersionProviderWrapper as wrapper } from '../../test-utils/youversion-provider-wrapper'
import { useBibleBookTitle } from '../use-bible-book-title'

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

function isBooksCatalogUrl(url: string): boolean {
  return /\/v1\/bibles\/\d+\/books(?:\?|$)/.test(url)
}

function restoreDefaultFetch() {
  if (defaultFetchImpl) {
    fetchMock.mockImplementation(defaultFetchImpl)
  }
}

const BOOKS_BODY = JSON.stringify({
  data: [
    { id: 'JHN', title: 'John' },
    { id: 'HEB', title: 'Hebrews' },
  ],
})

describe('useBibleBookTitle', () => {
  beforeEach(() => {
    mmkvStorage.clearAll()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    restoreDefaultFetch()
  })

  it('returns the title after the catalog loads', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isBooksCatalogUrl(url) && url.includes('/111/')) {
        return Promise.resolve(
          new Response(BOOKS_BODY, {
            status: 200,
            headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
          }),
        )
      }
      if (url.includes('/v1/fonts/')) {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 1, slug: 'untitled-serif', family: 'Untitled Serif', variants: [] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )
      }
      return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
    })

    const { result } = renderHook(() => useBibleBookTitle(111, 'JHN'), { wrapper: wrapper() })

    expect(result.current).toBeNull()
    await waitFor(() => {
      expect(result.current).toBe('John')
    })
  })

  it('looks up the next book from the loaded catalog without another fetch', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isBooksCatalogUrl(url) && url.includes('/111/')) {
        return Promise.resolve(
          new Response(BOOKS_BODY, {
            status: 200,
            headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
          }),
        )
      }
      if (url.includes('/v1/fonts/')) {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 1, slug: 'untitled-serif', family: 'Untitled Serif', variants: [] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )
      }
      return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
    })

    const { result, rerender } = renderHook(
      ({ book }: { book: string }) => useBibleBookTitle(111, book),
      { wrapper: wrapper(), initialProps: { book: 'JHN' } },
    )

    await waitFor(() => {
      expect(result.current).toBe('John')
    })
    const catalogCalls = fetchMock.mock.calls.filter(([input]) =>
      isBooksCatalogUrl(urlFromFetchInput(input)),
    ).length

    rerender({ book: 'HEB' })
    expect(result.current).toBe('Hebrews')
    expect(
      fetchMock.mock.calls.filter(([input]) => isBooksCatalogUrl(urlFromFetchInput(input))).length,
    ).toBe(catalogCalls)
  })

  it('stays null when the lookup fails', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (url.includes('/v1/fonts/')) {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 1, slug: 'untitled-serif', family: 'Untitled Serif', variants: [] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )
      }
      return Promise.reject(new Error('network down'))
    })

    const { result } = renderHook(() => useBibleBookTitle(3034, 'JHN'), { wrapper: wrapper() })

    expect(result.current).toBeNull()
    await waitFor(() => {
      const fetchedCatalog = fetchMock.mock.calls.some(([input]) =>
        isBooksCatalogUrl(urlFromFetchInput(input)),
      )
      expect(fetchedCatalog).toBe(true)
    })
    expect(result.current).toBeNull()
  })
})
