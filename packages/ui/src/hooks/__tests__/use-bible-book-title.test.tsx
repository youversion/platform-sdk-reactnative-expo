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

const BOOKS_BODY = JSON.stringify({
  data: [
    { id: 'JHN', title: 'John', chapters: [{ id: '1' }, { id: '2' }] },
    { id: 'HEB', title: 'Hebrews', chapters: [{ id: '1' }] },
  ],
})

const SPANISH_BOOKS_BODY = JSON.stringify({
  data: [{ id: 'JHN', title: 'Juan', chapters: [{ id: '1' }, { id: '2' }] }],
})

const CHAPTERS_1_2 = [
  { id: '1', title: '1' },
  { id: '2', title: '2' },
]
const JOHN_ENTRY = { title: 'John', chapters: CHAPTERS_1_2, intro: null }
const JUAN_ENTRY = { title: 'Juan', chapters: CHAPTERS_1_2, intro: null }
const HEBREWS_ENTRY = { title: 'Hebrews', chapters: [{ id: '1', title: '1' }], intro: null }

function booksResponse(body: string) {
  return Promise.resolve(
    new Response(body, {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
    }),
  )
}

describe('useBibleBookTitle', () => {
  beforeEach(() => {
    mmkvStorage.clearAll()
    fetchMock.mockClear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    restoreDefaultFetch()
  })

  it('returns the title after the catalog loads', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isBooksCatalogUrl(url) && url.includes('/111/')) {
        return booksResponse(BOOKS_BODY)
      }
      if (url.includes('/v1/fonts/')) {
        return fontResponse()
      }
      return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
    })

    const { result } = renderHook(() => useBibleBookTitle(111, 'JHN'), { wrapper: wrapper() })

    expect(result.current).toEqual({
      title: null,
      entry: null,
      isLoading: true,
      catalog: null,
    })
    await waitFor(() => {
      expect(result.current).toEqual({
        title: 'John',
        entry: JOHN_ENTRY,
        isLoading: false,
        catalog: expect.any(Map),
      })
    })
  })

  it('looks up the next book from the loaded catalog without another fetch', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isBooksCatalogUrl(url) && url.includes('/111/')) {
        return booksResponse(BOOKS_BODY)
      }
      if (url.includes('/v1/fonts/')) {
        return fontResponse()
      }
      return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
    })

    const { result, rerender } = renderHook(
      ({ book }: { book: string }) => useBibleBookTitle(111, book),
      { wrapper: wrapper(), initialProps: { book: 'JHN' } },
    )

    await waitFor(() => {
      expect(result.current.title).toBe('John')
    })
    const catalogCalls = fetchMock.mock.calls.filter(([input]) =>
      isBooksCatalogUrl(urlFromFetchInput(input)),
    ).length

    rerender({ book: 'HEB' })
    expect(result.current).toEqual({
      title: 'Hebrews',
      entry: HEBREWS_ENTRY,
      isLoading: false,
      catalog: expect.any(Map),
    })
    expect(
      fetchMock.mock.calls.filter(([input]) => isBooksCatalogUrl(urlFromFetchInput(input))).length,
    ).toBe(catalogCalls)
  })

  it('keeps the previous title and drops the catalog while the new version fetches', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isBooksCatalogUrl(url) && url.includes('/111/')) {
        return booksResponse(BOOKS_BODY)
      }
      if (isBooksCatalogUrl(url) && url.includes('/128/')) {
        return booksResponse(SPANISH_BOOKS_BODY)
      }
      if (url.includes('/v1/fonts/')) {
        return fontResponse()
      }
      return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
    })

    const { result, rerender } = renderHook(
      ({ versionId }: { versionId: number }) => useBibleBookTitle(versionId, 'JHN'),
      { wrapper: wrapper(), initialProps: { versionId: 111 } },
    )

    await waitFor(() => {
      expect(result.current.title).toBe('John')
    })

    rerender({ versionId: 128 })
    expect(result.current).toEqual({
      title: 'John',
      entry: JOHN_ENTRY,
      isLoading: true,
      catalog: null,
    })
    await waitFor(() => {
      expect(result.current).toEqual({
        title: 'Juan',
        entry: JUAN_ENTRY,
        isLoading: false,
        catalog: expect.any(Map),
      })
    })
  })

  it('paints a seen version from cache without a loading flash', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isBooksCatalogUrl(url) && url.includes('/111/')) {
        return booksResponse(BOOKS_BODY)
      }
      if (isBooksCatalogUrl(url) && url.includes('/128/')) {
        return booksResponse(SPANISH_BOOKS_BODY)
      }
      if (url.includes('/v1/fonts/')) {
        return fontResponse()
      }
      return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
    })

    const { result, rerender } = renderHook(
      ({ versionId }: { versionId: number }) => useBibleBookTitle(versionId, 'JHN'),
      { wrapper: wrapper(), initialProps: { versionId: 111 } },
    )

    await waitFor(() => {
      expect(result.current.title).toBe('John')
    })
    rerender({ versionId: 128 })
    await waitFor(() => {
      expect(result.current.title).toBe('Juan')
    })

    rerender({ versionId: 111 })
    expect(result.current).toEqual({
      title: 'John',
      entry: JOHN_ENTRY,
      isLoading: false,
      catalog: expect.any(Map),
    })
    await waitFor(() => {
      expect(result.current.title).toBe('John')
    })
  })

  it('drops the previous title and catalog when a version switch refetch fails', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isBooksCatalogUrl(url) && url.includes('/111/')) {
        return booksResponse(BOOKS_BODY)
      }
      if (url.includes('/v1/fonts/')) {
        return fontResponse()
      }
      return Promise.reject(new Error('network down'))
    })

    const { result, rerender } = renderHook(
      ({ versionId }: { versionId: number }) => useBibleBookTitle(versionId, 'JHN'),
      { wrapper: wrapper(), initialProps: { versionId: 111 } },
    )

    await waitFor(() => {
      expect(result.current.title).toBe('John')
    })

    rerender({ versionId: 999 })
    expect(result.current).toEqual({
      title: 'John',
      entry: JOHN_ENTRY,
      isLoading: true,
      catalog: null,
    })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current).toEqual({
      title: null,
      entry: null,
      isLoading: false,
      catalog: null,
    })
  })

  it('does not fetch when disabled', () => {
    const { result } = renderHook(() => useBibleBookTitle(111, 'JHN', { enabled: false }), {
      wrapper: wrapper(),
    })

    expect(result.current).toEqual({
      title: null,
      entry: null,
      isLoading: false,
      catalog: null,
    })
    expect(
      fetchMock.mock.calls.some(([input]) => isBooksCatalogUrl(urlFromFetchInput(input))),
    ).toBe(false)
  })

  it('stays null when the lookup fails', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (url.includes('/v1/fonts/')) {
        return fontResponse()
      }
      return Promise.reject(new Error('network down'))
    })

    const { result } = renderHook(() => useBibleBookTitle(3034, 'JHN'), { wrapper: wrapper() })

    expect(result.current).toEqual({
      title: null,
      entry: null,
      isLoading: true,
      catalog: null,
    })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current).toEqual({
      title: null,
      entry: null,
      isLoading: false,
      catalog: null,
    })
  })
})
