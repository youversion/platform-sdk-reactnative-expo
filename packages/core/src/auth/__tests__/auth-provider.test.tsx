import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useState } from 'react'
import { AppState, Pressable, Text, View } from 'react-native'
import AuthProvider from '../auth-provider'
import { MMKV_AUTH_KEYS } from '../constants'
import { refreshTokens, TokenEndpointError, type TokenResponse } from '../http'
import { signInWithPKCE } from '../pkce-flow'
import { loadTokens, saveTokens } from '../token-storage'
import type { AuthConfig } from '../types'
import { useYVAuth } from '../use-yv-auth'

const mockMmkv = new Map<string, string>()

jest.mock('../../storage/mmkv-storage', () => ({
  mmkvStorage: {
    set: jest.fn((k: string, v: string) => {
      mockMmkv.set(k, v)
    }),
    getString: jest.fn((k: string) => mockMmkv.get(k)),
    remove: jest.fn((k: string) => mockMmkv.delete(k)),
  },
}))

jest.mock('../token-storage', () => ({
  loadTokens: jest.fn(),
  saveTokens: jest.fn(() => Promise.resolve()),
}))

jest.mock('../http', () => ({
  ...jest.requireActual('../http'),
  refreshTokens: jest.fn(),
}))

jest.mock('../pkce-flow', () => ({
  signInWithPKCE: jest.fn(),
}))

const mockLoadTokens = loadTokens as jest.Mock
const mockSaveTokens = saveTokens as jest.Mock
const mockRefreshTokens = refreshTokens as jest.Mock
const mockSignInWithPKCE = signInWithPKCE as jest.Mock
const mockAppStateAddEventListener = jest.spyOn(AppState, 'addEventListener')

const defaultConfig: AuthConfig = { redirectUri: 'https://app/cb' }
const defaultProps = { config: defaultConfig, appKey: 'appkey', apiHost: 'api.example.com' }

function makeJwt(payload: unknown): string {
  const b64url = Buffer.from(JSON.stringify(payload), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `aaa.${b64url}.bbb`
}

const noStoredTokens = {
  accessToken: null,
  refreshToken: null,
  expiryDate: null,
}

const validTokens = {
  access_token: 'new-access',
  refresh_token: 'new-refresh',
  id_token: makeJwt({ sub: 'u1', name: 'Ada' }),
  expires_in: '3600',
  token_type: 'Bearer',
}

const adaUserInfo = { id: 'u1', name: 'Ada', email: undefined, avatarUrl: undefined }

function AuthPeek() {
  const auth = useYVAuth()
  const [signInOutcome, setSignInOutcome] = useState<string>('idle')

  return (
    <View>
      <Text testID="isLoading">{String(auth.isLoading)}</Text>
      <Text testID="isAuthenticated">{String(auth.isAuthenticated)}</Text>
      <Text testID="accessToken">{auth.accessToken ?? 'null'}</Text>
      <Text testID="userInfo">{auth.userInfo ? JSON.stringify(auth.userInfo) : 'null'}</Text>
      <Text testID="error">{auth.error?.message ?? 'null'}</Text>
      <Text testID="signInOutcome">{signInOutcome}</Text>
      <Pressable
        testID="signIn"
        onPress={async () => {
          setSignInOutcome('pending')
          try {
            await auth.signIn()
            setSignInOutcome('resolved')
          } catch (e) {
            setSignInOutcome(`rejected: ${(e as Error).message}`)
          }
        }}
      >
        <Text>signIn</Text>
      </Pressable>
      <Pressable testID="signOut" onPress={() => auth.signOut()}>
        <Text>signOut</Text>
      </Pressable>
    </View>
  )
}

function getText(id: string): string {
  return screen.getByTestId(id).props.children
}

function fireAppStateChange(state: string) {
  const handler = mockAppStateAddEventListener.mock.calls.at(-1)![1] as (s: string) => void
  handler(state)
}

beforeEach(() => {
  mockMmkv.clear()
  jest.clearAllMocks()
  mockAppStateAddEventListener.mockImplementation(() => ({ remove: jest.fn() }))
})

describe('AuthProvider — mount', () => {
  it('clears stale cached userInfo when no tokens are stored', async () => {
    mockMmkv.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify({ id: 'stale-user' }))
    mockLoadTokens.mockResolvedValue(noStoredTokens)

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )

    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(getText('isAuthenticated')).toBe('false')
    expect(getText('userInfo')).toBe('null')
    expect(mockMmkv.has(MMKV_AUTH_KEYS.cachedUserInfo)).toBe(false)
    expect(mockRefreshTokens).not.toHaveBeenCalled()
  })

  it('hydrates state from stored tokens and skips refresh when not near expiry', async () => {
    mockMmkv.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify(adaUserInfo))
    mockLoadTokens.mockResolvedValue({
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
      expiryDate: new Date(Date.now() + 60 * 60 * 1000),
    })

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )

    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(getText('isAuthenticated')).toBe('true')
    expect(getText('accessToken')).toBe('stored-access')
    expect(JSON.parse(getText('userInfo'))).toEqual(adaUserInfo)
    expect(mockRefreshTokens).not.toHaveBeenCalled()
  })

  it('re-sanitizes a placeholder avatarUrl cached by a pre-fix build', async () => {
    mockMmkv.set(
      MMKV_AUTH_KEYS.cachedUserInfo,
      JSON.stringify({ id: 'u1', name: 'Ada', avatarUrl: 'https://none/' }),
    )
    mockLoadTokens.mockResolvedValue({
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
      expiryDate: new Date(Date.now() + 60 * 60 * 1000),
    })

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )

    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(JSON.parse(getText('userInfo')).avatarUrl).toBeUndefined()
  })

  it('drops wrong-typed fields from a tampered/corrupt cached userInfo instead of trusting them', async () => {
    mockMmkv.set(
      MMKV_AUTH_KEYS.cachedUserInfo,
      JSON.stringify({ id: 42, name: { first: 'Ada' }, email: 'ada@example.com' }),
    )
    mockLoadTokens.mockResolvedValue({
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
      expiryDate: new Date(Date.now() + 60 * 60 * 1000),
    })

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )

    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(JSON.parse(getText('userInfo'))).toEqual({
      id: undefined,
      name: undefined,
      email: 'ada@example.com',
      avatarUrl: undefined,
    })
  })

  it('returns null userInfo when cached JSON is a non-object (e.g. "null")', async () => {
    mockMmkv.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify(null))
    mockLoadTokens.mockResolvedValue({
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
      expiryDate: new Date(Date.now() + 60 * 60 * 1000),
    })

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )

    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(getText('userInfo')).toBe('null')
  })

  it('triggers a refresh when the stored token is expired and applies the new tokens', async () => {
    mockLoadTokens.mockResolvedValue({
      accessToken: 'stale-access',
      refreshToken: 'stale-refresh',
      expiryDate: new Date(Date.now() - 1000),
    })
    mockRefreshTokens.mockResolvedValue(validTokens)

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )

    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(mockRefreshTokens).toHaveBeenCalledTimes(1)
    expect(mockRefreshTokens).toHaveBeenCalledWith({
      apiHost: 'api.example.com',
      appKey: 'appkey',
      refreshToken: 'stale-refresh',
    })
    expect(getText('accessToken')).toBe('new-access')
  })

  it('sets error when refreshing an expired stored token fails', async () => {
    mockLoadTokens.mockResolvedValue({
      accessToken: 'stale-access',
      refreshToken: 'stale-refresh',
      expiryDate: new Date(Date.now() - 1000),
    })
    mockRefreshTokens.mockRejectedValue(new Error('refresh failed'))

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )

    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(getText('error')).toBe('refresh failed')
    expect(mockRefreshTokens).toHaveBeenCalledTimes(1)
  })

  it('sets error and finishes loading when loadTokens rejects', async () => {
    mockLoadTokens.mockRejectedValue(new Error('storage offline'))

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )

    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(getText('error')).toBe('storage offline')
    expect(getText('isAuthenticated')).toBe('false')
  })
})

describe('AuthProvider — signIn', () => {
  beforeEach(() => {
    mockLoadTokens.mockResolvedValue(noStoredTokens)
  })

  it('on success, applies tokens and exposes user info', async () => {
    mockSignInWithPKCE.mockResolvedValue({
      kind: 'success',
      tokens: validTokens,
      userInfo: adaUserInfo,
    })

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )
    await waitFor(() => expect(getText('isLoading')).toBe('false'))

    fireEvent.press(screen.getByTestId('signIn'))

    await waitFor(() => expect(getText('signInOutcome')).toBe('resolved'))
    expect(getText('isAuthenticated')).toBe('true')
    expect(getText('accessToken')).toBe('new-access')
    expect(JSON.parse(getText('userInfo'))).toEqual(adaUserInfo)
    expect(getText('error')).toBe('null')
    expect(mockSaveTokens).toHaveBeenCalled()
  })

  it('on cancel, leaves state unchanged and reports no error', async () => {
    mockSignInWithPKCE.mockResolvedValue({ kind: 'cancel' })

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )
    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    mockSaveTokens.mockClear()

    fireEvent.press(screen.getByTestId('signIn'))
    await waitFor(() => expect(getText('signInOutcome')).toBe('resolved'))

    expect(getText('isAuthenticated')).toBe('false')
    expect(getText('error')).toBe('null')
    expect(mockSaveTokens).not.toHaveBeenCalled()
  })

  it('on failure, sets error AND re-throws so awaiters see the rejection', async () => {
    mockSignInWithPKCE.mockRejectedValue(new Error('PKCE blew up'))

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )
    await waitFor(() => expect(getText('isLoading')).toBe('false'))

    fireEvent.press(screen.getByTestId('signIn'))

    await waitFor(() => expect(getText('signInOutcome')).toBe('rejected: PKCE blew up'))
    expect(getText('error')).toBe('PKCE blew up')
    expect(getText('isAuthenticated')).toBe('false')
  })
})

describe('AuthProvider — signOut', () => {
  it('clears tokens, resets in-memory state, and removes cached userInfo', async () => {
    mockMmkv.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify({ id: 'u1' }))
    mockLoadTokens.mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
      expiryDate: new Date(Date.now() + 60 * 60 * 1000),
    })

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )
    await waitFor(() => expect(getText('isAuthenticated')).toBe('true'))

    fireEvent.press(screen.getByTestId('signOut'))

    await waitFor(() => expect(getText('isAuthenticated')).toBe('false'))
    expect(getText('accessToken')).toBe('null')
    expect(getText('userInfo')).toBe('null')
    expect(mockSaveTokens).toHaveBeenCalledWith({
      accessToken: null,
      refreshToken: null,
      expiryDate: null,
    })
    expect(mockMmkv.has(MMKV_AUTH_KEYS.cachedUserInfo)).toBe(false)
  })
})

describe('AuthProvider — refresh failure policy', () => {
  const expiredStored = {
    accessToken: 'stored-access',
    refreshToken: 'stored-refresh',
    expiryDate: new Date(Date.now() - 1000),
  }
  const clearedTokens = { accessToken: null, refreshToken: null, expiryDate: null }

  it('keeps tokens on a transient error (e.g. network failure) so the user can retry', async () => {
    mockLoadTokens.mockResolvedValue(expiredStored)
    mockRefreshTokens.mockRejectedValue(new Error('Network request failed'))

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )

    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(getText('error')).toBe('Network request failed')
    expect(getText('isAuthenticated')).toBe('true')
    expect(getText('accessToken')).toBe('stored-access')
    expect(mockSaveTokens).not.toHaveBeenCalledWith(clearedTokens)
  })

  it('clears tokens when the refresh token is revoked (TokenEndpointError 401)', async () => {
    mockLoadTokens.mockResolvedValue(expiredStored)
    mockRefreshTokens.mockRejectedValue(new TokenEndpointError(401, 'invalid_grant'))

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )

    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(getText('isAuthenticated')).toBe('false')
    expect(getText('accessToken')).toBe('null')
    expect(getText('error')).toMatch(/401/)
    expect(mockSaveTokens).toHaveBeenCalledWith(clearedTokens)
  })
})

describe('AuthProvider — refresh lock', () => {
  it('prevents concurrent refresh calls (only one HTTP call while one is in flight)', async () => {
    mockLoadTokens.mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
      expiryDate: new Date(Date.now() - 1000),
    })

    let resolveRefresh: (v: TokenResponse) => void = () => {}
    mockRefreshTokens.mockReturnValue(
      new Promise<TokenResponse>((r) => {
        resolveRefresh = r
      }),
    )

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )

    await waitFor(() => expect(mockRefreshTokens).toHaveBeenCalledTimes(1))

    await act(async () => {
      fireAppStateChange('active')
    })

    expect(mockRefreshTokens).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveRefresh(validTokens)
    })
    await waitFor(() => expect(getText('isLoading')).toBe('false'))
  })
})

describe('AuthProvider — AppState wiring', () => {
  it('does not trigger a refresh on "active" when no refresh token is available', async () => {
    mockLoadTokens.mockResolvedValue(noStoredTokens)

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )
    await waitFor(() => expect(getText('isLoading')).toBe('false'))

    await act(async () => {
      fireAppStateChange('active')
    })

    expect(mockRefreshTokens).not.toHaveBeenCalled()
  })

  it('registers a "change" listener on mount and removes it on unmount', async () => {
    mockLoadTokens.mockResolvedValue(noStoredTokens)
    const remove = jest.fn()
    mockAppStateAddEventListener.mockReturnValue({ remove })

    const { unmount } = render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )
    await waitFor(() => expect(getText('isLoading')).toBe('false'))

    expect(mockAppStateAddEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    expect(remove).not.toHaveBeenCalled()

    unmount()
    expect(remove).toHaveBeenCalledTimes(1)
  })
})
