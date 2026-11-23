import { renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import type { HookOverrides } from '../../hook-overrides'
import { YouVersionContext } from '../../youversion-context'
import type { UsePlaylistsResult } from '../use-playlists'
import { usePlaylists } from '../use-playlists'

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

describe('usePlaylists', () => {
  it('throws when used outside YouVersionProvider', () => {
    expect(() => renderHook(() => usePlaylists())).toThrow(
      /useYouVersion must be used inside of YouVersionProvider/,
    )
  })

  it('lists playlists for the provider host', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: [], next_page_token: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const { result } = renderHook(() => usePlaylists(), {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    })

    const page = await result.current.list('550e8400-e29b-41d4-a716-446655440000', {
      pageSize: 10,
    })
    expect(page).toEqual({ ok: true, value: { data: [], next_page_token: null } })
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain(
      'https://api.example.com/v1-beta/organizations/550e8400-e29b-41d4-a716-446655440000/playlists',
    )
  })

  it('returns the hookOverrides stub instead of calling fetch', async () => {
    const stub: UsePlaylistsResult = {
      list: jest.fn(async () => ({ ok: true as const, value: { data: [], next_page_token: null } })),
      get: jest.fn(async () => ({
        ok: true as const,
        value: {
          id: 1,
          title: 'Stub',
          description: null,
          type: 'TEACHING_CLIPS',
          total: 0,
          videos: [],
        },
      })),
    }
    const { result } = renderHook(() => usePlaylists(), {
      wrapper: ({ children }) => (
        <Wrapper hookOverrides={{ usePlaylists: () => stub }}>{children}</Wrapper>
      ),
    })

    expect(result.current).toBe(stub)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
