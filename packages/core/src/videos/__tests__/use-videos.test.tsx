import { renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import type { HookOverrides } from '../../hook-overrides'
import { YouVersionContext } from '../../youversion-context'
import type { UseVideosResult } from '../use-videos'
import { useVideos } from '../use-videos'

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

describe('useVideos', () => {
  it('throws when used outside YouVersionProvider', () => {
    expect(() => renderHook(() => useVideos())).toThrow(
      /useYouVersion must be used inside of YouVersionProvider/,
    )
  })

  it('reads provider config and gets a video', async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'clip-1',
          playback_sources: [],
          playback_preview_sources: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )

    const { result } = renderHook(() => useVideos(), {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    })

    const video = await result.current.get('clip-1')
    expect(video).toEqual({
      ok: true,
      value: { id: 'clip-1', playback_sources: [], playback_preview_sources: [] },
    })
    expect(String(mockFetch.mock.calls[0]?.[0])).toBe(
      'https://api.example.com/v1-beta/videos/clip-1',
    )
  })

  it('returns the hookOverrides stub instead of calling fetch', async () => {
    const stub: UseVideosResult = {
      get: jest.fn(async () => ({
        ok: true as const,
        value: { id: 'stub', playback_sources: [], playback_preview_sources: [] },
      })),
    }
    const { result } = renderHook(() => useVideos(), {
      wrapper: ({ children }) => (
        <Wrapper hookOverrides={{ useVideos: () => stub }}>{children}</Wrapper>
      ),
    })

    expect(result.current).toBe(stub)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
