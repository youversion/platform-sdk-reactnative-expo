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

function restoreDefaultFetch() {
  if (defaultFetchImpl) {
    fetchMock.mockImplementation(defaultFetchImpl)
  }
}

describe('useBibleVersionAbbreviation', () => {
  beforeEach(() => {
    mmkvStorage.clearAll()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    restoreDefaultFetch()
  })

  it('returns the abbreviation after a successful lookup', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (url.includes('/v1/bibles/111') && !url.includes('/chapters/')) {
        return Promise.resolve(
          new Response(JSON.stringify({ abbreviation: 'NIV' }), {
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

    const { result } = renderHook(() => useBibleVersionAbbreviation(111), { wrapper: wrapper() })

    expect(result.current).toBeNull()
    await waitFor(() => {
      expect(result.current).toBe('NIV')
    })
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

    const { result } = renderHook(() => useBibleVersionAbbreviation(3034), { wrapper: wrapper() })

    expect(result.current).toBeNull()
    await waitFor(() => {
      const fetchedVersion = fetchMock.mock.calls.some(([input]) =>
        urlFromFetchInput(input).includes('/v1/bibles/'),
      )
      expect(fetchedVersion).toBe(true)
    })
    expect(result.current).toBeNull()
  })
})
