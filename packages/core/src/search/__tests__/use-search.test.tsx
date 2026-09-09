import { renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import type { HookOverrides } from '../../hook-overrides'
import { YouVersionContext } from '../../youversion-context'
import type { UseSearchResult } from '../use-search'
import { useSearch } from '../use-search'

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
})

function Wrapper({
  children,
  hookOverrides,
}: {
  children: ReactNode
  hookOverrides?: HookOverrides
}) {
  return (
    <YouVersionContext.Provider
      value={{
        appKey: 'app-key',
        apiHost: 'api.example.com',
        installationId: 'install-1',
        fetchBibleContent: jest.fn(),
        hookOverrides,
      }}
    >
      {children}
    </YouVersionContext.Provider>
  )
}

describe('useSearch', () => {
  it('throws when used outside YouVersionProvider', () => {
    expect(() => renderHook(() => useSearch())).toThrow(
      /useYouVersion must be used inside of YouVersionProvider/,
    )
  })

  it('reads provider config and returns the four operations', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ text: 'love', source: 'trending' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const { result } = renderHook(() => useSearch(), {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    })

    expect(result.current.suggestedQueries).toEqual(expect.any(Function))
    expect(result.current.trendingQueries).toEqual(expect.any(Function))
    expect(result.current.verses).toEqual(expect.any(Function))
    expect(result.current.topics).toEqual(expect.any(Function))

    const trending = await result.current.trendingQueries({ languageRanges: ['en'] })
    expect(trending).toEqual({
      ok: true,
      value: [{ text: 'love', source: 'trending' }],
    })
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain('https://api.example.com/v1-beta/search-queries')
  })

  it('returns the hookOverrides stub instead of calling fetch', async () => {
    const stub: UseSearchResult = {
      suggestedQueries: jest.fn(async () => ({ ok: true as const, value: [{ text: 'stub' }] })),
      trendingQueries: jest.fn(async () => ({ ok: true as const, value: [] })),
      verses: jest.fn(async () => ({
        ok: true as const,
        value: { verses: [], didYouMean: [] },
      })),
      topics: jest.fn(async () => ({
        ok: true as const,
        value: { topics: [], didYouMean: [], totalSize: 0 },
      })),
    }

    const { result } = renderHook(() => useSearch(), {
      wrapper: ({ children }) => <Wrapper hookOverrides={{ useSearch: () => stub }}>{children}</Wrapper>,
    })

    expect(result.current).toBe(stub)
    const suggested = await result.current.suggestedQueries({ query: 'love', languageRanges: ['en'] })
    expect(suggested).toEqual({ ok: true, value: [{ text: 'stub' }] })
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
