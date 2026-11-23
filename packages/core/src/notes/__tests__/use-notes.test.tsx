import { renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import type { HookOverrides } from '../../hook-overrides'
import { YouVersionContext } from '../../youversion-context'
import type { UseNotesResult } from '../use-notes'
import { useNotes } from '../use-notes'

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

describe('useNotes', () => {
  it('throws when used outside YouVersionProvider', () => {
    expect(() => renderHook(() => useNotes())).toThrow(
      /useYouVersion must be used inside of YouVersionProvider/,
    )
  })

  it('lists notes with the provider host and the caller token', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: [], next_page_token: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const { result } = renderHook(() => useNotes(), {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    })

    expect(result.current.list).toEqual(expect.any(Function))
    expect(result.current.get).toEqual(expect.any(Function))
    expect(result.current.create).toEqual(expect.any(Function))
    expect(result.current.update).toEqual(expect.any(Function))
    expect(result.current.delete).toEqual(expect.any(Function))

    const page = await result.current.list('reader', { passage_id: 'JHN.3' })
    expect(page).toEqual({ ok: true, value: { data: [], next_page_token: null } })
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain('https://api.example.com/v1/notes')
    expect(new Headers(mockFetch.mock.calls[0]?.[1]?.headers).get('authorization')).toBe(
      'Bearer reader',
    )
  })

  it('keeps the methods until appKey or apiHost changes', () => {
    let appKey = 'app-key'
    let apiHost = 'api.example.com'

    function ConfigWrapper({ children }: { children: ReactNode }) {
      return (
        <YouVersionContext.Provider
          value={{
            appKey,
            apiHost,
            installationId: 'install-1',
            fetchBibleContent: jest.fn(),
          }}
        >
          {children}
        </YouVersionContext.Provider>
      )
    }

    const { result, rerender } = renderHook((_props: undefined) => useNotes(), {
      wrapper: ConfigWrapper,
    })
    const firstList = result.current.list

    rerender(undefined)
    expect(result.current.list).toBe(firstList)

    appKey = 'other-key'
    rerender(undefined)
    expect(result.current.list).not.toBe(firstList)

    const nextList = result.current.list
    apiHost = 'other.example.com'
    rerender(undefined)
    expect(result.current.list).not.toBe(nextList)
  })

  it('returns the hookOverrides stub instead of calling fetch', async () => {
    const stub: UseNotesResult = {
      list: jest.fn(async () => ({
        ok: true as const,
        value: { data: [], next_page_token: null },
      })),
      get: jest.fn(async () => ({
        ok: true as const,
        value: {
          id: 'stub',
          content: 'Stub',
          status: 'private' as const,
        },
      })),
      create: jest.fn(async () => ({
        ok: true as const,
        value: { id: 'stub', content: 'Stub', status: 'private' as const },
      })),
      update: jest.fn(async () => ({
        ok: true as const,
        value: { id: 'stub', content: 'Stub', status: 'private' as const },
      })),
      delete: jest.fn(async () => ({ ok: true as const, value: undefined })),
    }

    const { result } = renderHook(() => useNotes(), {
      wrapper: ({ children }) => (
        <Wrapper hookOverrides={{ useNotes: () => stub }}>{children}</Wrapper>
      ),
    })

    expect(result.current).toBe(stub)
    await result.current.list('reader')
    expect(stub.list).toHaveBeenCalledWith('reader')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
