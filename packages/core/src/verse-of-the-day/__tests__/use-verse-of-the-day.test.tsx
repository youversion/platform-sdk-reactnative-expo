import { renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import pkg from '../../../package.json'
import type { HookOverrides } from '../../hook-overrides'
import { YouVersionContext } from '../../youversion-context'
import type { UseVerseOfTheDayResult } from '../use-verse-of-the-day'
import { useVerseOfTheDay } from '../use-verse-of-the-day'

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
})

function Wrapper({
  children,
  hookOverrides,
  appKey = 'app-key',
  apiHost = 'api.example.com',
  installationId = 'install-1',
}: {
  children: ReactNode
  hookOverrides?: HookOverrides
  appKey?: string
  apiHost?: string
  installationId?: string
}) {
  return (
    <YouVersionContext.Provider
      value={{
        appKey,
        apiHost,
        installationId,
        fetchBibleContent: jest.fn(),
        hookOverrides,
      }}
    >
      {children}
    </YouVersionContext.Provider>
  )
}

describe('useVerseOfTheDay', () => {
  it('throws when used outside YouVersionProvider', () => {
    expect(() => renderHook(() => useVerseOfTheDay())).toThrow(
      /useYouVersion must be used inside of YouVersionProvider/,
    )
  })

  it('reads provider config and returns get and list', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ day: 15, passage_id: 'JHN.3.16' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const { result } = renderHook(() => useVerseOfTheDay(), {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    })

    expect(result.current.get).toEqual(expect.any(Function))
    expect(result.current.list).toEqual(expect.any(Function))

    const day = await result.current.get(15)
    expect(day).toEqual({
      ok: true,
      value: { day: 15, passage_id: 'JHN.3.16', image_id: null },
    })
    expect(String(mockFetch.mock.calls[0]?.[0])).toBe(
      'https://api.example.com/v1/verse-of-the-days/15',
    )

    const headers = new Headers(mockFetch.mock.calls[0]?.[1]?.headers)
    expect(headers.get('x-yvp-sdk')).toBe(`ReactNativeSDK=${pkg.version}-dev`)
    expect(headers.get('authorization')).toBeNull()
  })

  it('keeps get and list until appKey, apiHost, or installationId changes', () => {
    let appKey = 'app-key'
    let apiHost = 'api.example.com'
    let installationId = 'install-1'

    function ConfigWrapper({ children }: { children: ReactNode }) {
      return (
        <YouVersionContext.Provider
          value={{
            appKey,
            apiHost,
            installationId,
            fetchBibleContent: jest.fn(),
          }}
        >
          {children}
        </YouVersionContext.Provider>
      )
    }

    const { result, rerender } = renderHook((_props: undefined) => useVerseOfTheDay(), {
      wrapper: ConfigWrapper,
    })
    const firstGet = result.current.get
    const firstList = result.current.list

    rerender(undefined)
    expect(result.current.get).toBe(firstGet)
    expect(result.current.list).toBe(firstList)

    appKey = 'other-key'
    rerender(undefined)
    expect(result.current.get).not.toBe(firstGet)
    expect(result.current.list).not.toBe(firstList)

    const afterKeyGet = result.current.get
    const afterKeyList = result.current.list
    apiHost = 'other.example.com'
    rerender(undefined)
    expect(result.current.get).not.toBe(afterKeyGet)
    expect(result.current.list).not.toBe(afterKeyList)

    const afterHostGet = result.current.get
    const afterHostList = result.current.list
    installationId = 'install-2'
    rerender(undefined)
    expect(result.current.get).not.toBe(afterHostGet)
    expect(result.current.list).not.toBe(afterHostList)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns the hookOverrides stub instead of calling fetch', async () => {
    const stub: UseVerseOfTheDayResult = {
      get: jest.fn(async () => ({
        ok: true as const,
        value: { day: 1, passage_id: 'JHN.3.16', image_id: null },
      })),
      list: jest.fn(async () => ({
        ok: true as const,
        value: { data: [], next_page_token: null },
      })),
    }

    const { result } = renderHook(() => useVerseOfTheDay(), {
      wrapper: ({ children }) => (
        <Wrapper hookOverrides={{ useVerseOfTheDay: () => stub }}>{children}</Wrapper>
      ),
    })

    expect(result.current).toBe(stub)
    const day = await result.current.get(1)
    expect(day).toEqual({
      ok: true,
      value: { day: 1, passage_id: 'JHN.3.16', image_id: null },
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
