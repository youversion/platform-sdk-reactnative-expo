/**
 * Layer 1 — paint-only null-scope path. A known Highlight Scope paints that
 * chapter's cache. A null scope (VOTD still loading, lookup failed, invalid
 * USFM) must yield `[]` so other-version / other-chapter rows cannot paint.
 */
import type { Highlight } from '@youversion/platform-core'
import { act, renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { AuthContext, type AccessTokenResult, type AuthContextValue } from '../../auth/auth-context'
import { mmkvStorage } from '../../storage/mmkv-storage'
import { YouVersionContext } from '../../youversion-context'
import * as api from '../api'
import { highlightsCacheKey, type HighlightScope } from '../constants'
import { useHighlightPaint } from '../use-highlight-paint'

const mockGetHighlights = jest.fn()

const YELLOW = 'fffe00'
const GREEN = '5dff79'
const userId = 'user-1'
const jhn3: HighlightScope = { versionId: 111, book: 'JHN', chapter: '3' }
const mat5OtherVersion: HighlightScope = { versionId: 222, book: 'MAT', chapter: '5' }

function highlight(passageId: string, color: string, versionId: number): Highlight {
  return { version_id: versionId, passage_id: passageId, color }
}

function authValue(): AuthContextValue {
  return {
    isAuthenticated: true,
    accessToken: 'token-1',
    userInfo: { id: userId },
    error: null,
    signIn: jest.fn(async () => undefined),
    signOut: jest.fn(async () => undefined),
    refreshNow: jest.fn(async () => undefined),
    getAccessToken: jest.fn(
      async (): Promise<AccessTokenResult> => ({
        status: 'ok',
        token: 'token-1',
        userId,
      }),
    ),
    isLoading: false,
    requestedPermissions: ['highlights'],
    grantedPermissions: null,
    hasPermission: jest.fn(() => false),
    invalidatePermissions: jest.fn(),
    requestPermissions: jest.fn(),
  }
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <YouVersionContext.Provider
      value={{ appKey: 'app-key', apiHost: 'api.youversion.com', installationId: 'install-1' }}
    >
      <AuthContext.Provider value={authValue()}>{children}</AuthContext.Provider>
    </YouVersionContext.Provider>
  )
}

function seedCache(scope: HighlightScope, rows: Highlight[]) {
  mmkvStorage.set(highlightsCacheKey(userId, scope), JSON.stringify(rows))
}

beforeEach(() => {
  mmkvStorage.clearAll()
  mockGetHighlights.mockReset()
  mockGetHighlights.mockResolvedValue({ ok: true, value: { data: [], next_page_token: null } })
  jest.spyOn(api, 'createHighlightsApi').mockReturnValue({
    getHighlights: mockGetHighlights,
    createHighlight: jest.fn(),
    deleteHighlight: jest.fn(),
  })
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('useHighlightPaint', () => {
  it('yields [] for a null scope even when other chapters and versions are cached', async () => {
    seedCache(jhn3, [highlight('JHN.3.16', YELLOW, 111)])
    seedCache(mat5OtherVersion, [highlight('MAT.5.1', GREEN, 222)])

    const { result } = renderHook(() => useHighlightPaint(null), { wrapper: Wrapper })

    expect(result.current).toEqual([])
    expect(mockGetHighlights).not.toHaveBeenCalled()

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current).toEqual([])
    expect(mockGetHighlights).not.toHaveBeenCalled()
  })

  it('paints the known scope from cache and ignores other-version rows', async () => {
    const jhnRow = highlight('JHN.3.16', YELLOW, 111)
    seedCache(jhn3, [jhnRow])
    seedCache(mat5OtherVersion, [highlight('MAT.5.1', GREEN, 222)])
    mockGetHighlights.mockResolvedValue({
      ok: true,
      value: { data: [jhnRow], next_page_token: null },
    })

    const { result } = renderHook(() => useHighlightPaint(jhn3), { wrapper: Wrapper })

    expect(result.current).toEqual([jhnRow])

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current).toEqual([jhnRow])
    expect(result.current).not.toContainEqual(highlight('MAT.5.1', GREEN, 222))
  })
})
