import { renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import type { HookOverrides } from '../../hook-overrides'
import { YouVersionContext } from '../../youversion-context'
import type { UseImagesResult } from '../use-images'
import { useImages } from '../use-images'

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

describe('useImages', () => {
  it('throws when used outside YouVersionProvider', () => {
    expect(() => renderHook(() => useImages())).toThrow(
      /useYouVersion must be used inside of YouVersionProvider/,
    )
  })

  it('reads provider config and returns list and get', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const { result } = renderHook(() => useImages(), {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    })

    expect(result.current.list).toEqual(expect.any(Function))
    expect(result.current.get).toEqual(expect.any(Function))

    const page = await result.current.list({ passageId: 'JHN.3.16' })
    expect(page).toEqual({
      ok: true,
      value: { images: [], nextPageToken: null, totalSize: null },
    })
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain('https://api.example.com/v1-beta/images')
  })

  it('returns the hookOverrides stub instead of calling fetch', async () => {
    const stub: UseImagesResult = {
      list: jest.fn(async () => ({
        ok: true as const,
        value: { images: [], nextPageToken: null, totalSize: null },
      })),
      get: jest.fn(async () => ({
        ok: true as const,
        value: {
          id: 'stub',
          imageUrl: 'https://cdn.example.com/stub.jpg',
          passageId: 'JHN.3.16',
          attribution: 'stub',
          languageTag: 'en',
          width: 1,
          height: 1,
          aspectRatio: 1,
        },
      })),
    }

    const { result } = renderHook(() => useImages(), {
      wrapper: ({ children }) => (
        <Wrapper hookOverrides={{ useImages: () => stub }}>{children}</Wrapper>
      ),
    })

    expect(result.current).toBe(stub)
    const page = await result.current.list({ passageId: 'JHN.3.16' })
    expect(page).toEqual({
      ok: true,
      value: { images: [], nextPageToken: null, totalSize: null },
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
