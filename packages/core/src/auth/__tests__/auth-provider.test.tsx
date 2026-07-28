import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useState } from 'react'
import { AppState, Pressable, Text, View } from 'react-native'
import AuthProvider from '../auth-provider'
import { MMKV_AUTH_KEYS } from '../constants'
import { requestPermissionViaDataExchange } from '../data-exchange'
import { clearGrantedPermissions, grantedPermissionsKey } from '../granted-permissions'
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
    getAllKeys: jest.fn(() => Array.from(mockMmkv.keys())),
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

jest.mock('../data-exchange', () => ({
  requestPermissionViaDataExchange: jest.fn(),
}))

const mockLoadTokens = loadTokens as jest.Mock
const mockSaveTokens = saveTokens as jest.Mock
const mockRefreshTokens = refreshTokens as jest.Mock
const mockSignInWithPKCE = signInWithPKCE as jest.Mock
const mockRequestPermission = requestPermissionViaDataExchange as jest.Mock
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
  const [permissionOutcome, setPermissionOutcome] = useState<string>('idle')

  return (
    <View>
      <Text testID="isLoading">{String(auth.isLoading)}</Text>
      <Text testID="isAuthenticated">{String(auth.isAuthenticated)}</Text>
      <Text testID="accessToken">{auth.accessToken ?? 'null'}</Text>
      <Text testID="userInfo">{auth.userInfo ? JSON.stringify(auth.userInfo) : 'null'}</Text>
      <Text testID="grantedPermissions">
        {auth.grantedPermissions === null ? 'null' : JSON.stringify(auth.grantedPermissions)}
      </Text>
      <Text testID="hasHighlights">{String(auth.hasPermission('highlights'))}</Text>
      <Text testID="error">{auth.error?.message ?? 'null'}</Text>
      <Text testID="signInOutcome">{signInOutcome}</Text>
      <Text testID="permissionOutcome">{permissionOutcome}</Text>
      <Pressable
        testID="requestPermission"
        onPress={async () => {
          const result = await auth.requestPermission('highlights')
          setPermissionOutcome(JSON.stringify(result))
        }}
      >
        <Text>requestPermission</Text>
      </Pressable>
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
  // Module state, so it outlives `mockMmkv.clear()` on its own.
  clearGrantedPermissions()
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
  it('clears tokens, resets in-memory state, and removes cached userInfo and highlights', async () => {
    const highlightsKey = 'yvp.highlights.user-1.111.JHN.3'
    mockMmkv.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify({ id: 'u1' }))
    mockMmkv.set(
      highlightsKey,
      JSON.stringify([{ version_id: 111, passage_id: 'JHN.3.16', color: 'fffe00' }]),
    )
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
    expect(mockMmkv.has(highlightsKey)).toBe(false)
  })
})

describe('AuthProvider — granted permissions', () => {
  const withHighlights: AuthConfig = { ...defaultConfig, permissions: ['highlights'] }
  const storedTokens = {
    accessToken: 'stored-access',
    refreshToken: 'stored-refresh',
    expiryDate: new Date(Date.now() + 60 * 60 * 1000),
  }

  function grants(userId: string, permissions: string[]) {
    return [grantedPermissionsKey(userId), JSON.stringify({ userId, permissions })] as const
  }

  it('reports unknown — not empty — when signed out', async () => {
    mockLoadTokens.mockResolvedValue(noStoredTokens)

    render(
      <AuthProvider {...defaultProps} config={withHighlights}>
        <AuthPeek />
      </AuthProvider>,
    )

    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(getText('grantedPermissions')).toBe('null')
    expect(getText('hasHighlights')).toBe('false')
  })

  it('hydrates the signed-in user’s grants on mount, alongside userInfo', async () => {
    mockMmkv.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify(adaUserInfo))
    mockMmkv.set(...grants('u1', ['highlights', 'votd']))
    mockLoadTokens.mockResolvedValue(storedTokens)

    render(
      <AuthProvider {...defaultProps} config={withHighlights}>
        <AuthPeek />
      </AuthProvider>,
    )

    // Synchronous, like the cached userInfo it is keyed on — no waiting.
    expect(JSON.parse(getText('grantedPermissions'))).toEqual(['highlights', 'votd'])
    expect(getText('hasHighlights')).toBe('true')
    await waitFor(() => expect(getText('isLoading')).toBe('false'))
  })

  it('does not read another user’s grants', async () => {
    mockMmkv.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify(adaUserInfo))
    mockMmkv.set(...grants('someone-else', ['highlights']))
    mockLoadTokens.mockResolvedValue(storedTokens)

    render(
      <AuthProvider {...defaultProps} config={withHighlights}>
        <AuthPeek />
      </AuthProvider>,
    )

    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(getText('grantedPermissions')).toBe('null')
  })

  it('seeds the mirror from what sign-in requested', async () => {
    mockLoadTokens.mockResolvedValue(noStoredTokens)
    mockSignInWithPKCE.mockResolvedValue({
      kind: 'success',
      tokens: validTokens,
      userInfo: adaUserInfo,
    })

    render(
      <AuthProvider {...defaultProps} config={withHighlights}>
        <AuthPeek />
      </AuthProvider>,
    )
    await waitFor(() => expect(getText('isLoading')).toBe('false'))

    fireEvent.press(screen.getByTestId('signIn'))

    await waitFor(() => expect(getText('hasHighlights')).toBe('true'))
    expect(JSON.parse(getText('grantedPermissions'))).toEqual(['highlights'])
  })

  it('replaces a previous session’s grants on a fresh sign-in rather than unioning', async () => {
    mockMmkv.set(...grants('u1', ['highlights']))
    mockLoadTokens.mockResolvedValue(noStoredTokens)
    mockSignInWithPKCE.mockResolvedValue({
      kind: 'success',
      tokens: validTokens,
      userInfo: adaUserInfo,
    })

    render(
      <AuthProvider {...defaultProps} config={{ ...defaultConfig, permissions: ['votd'] }}>
        <AuthPeek />
      </AuthProvider>,
    )
    await waitFor(() => expect(getText('isLoading')).toBe('false'))

    fireEvent.press(screen.getByTestId('signIn'))

    await waitFor(() => expect(JSON.parse(getText('grantedPermissions'))).toEqual(['votd']))
    expect(getText('hasHighlights')).toBe('false')
  })

  it('records an empty set when sign-in requested nothing', async () => {
    mockLoadTokens.mockResolvedValue(noStoredTokens)
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

    await waitFor(() => expect(getText('grantedPermissions')).toBe('[]'))
  })

  it('drops every user’s grants on sign-out', async () => {
    mockMmkv.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify(adaUserInfo))
    mockMmkv.set(...grants('u1', ['highlights']))
    mockMmkv.set(...grants('u2', ['highlights']))
    mockLoadTokens.mockResolvedValue(storedTokens)

    render(
      <AuthProvider {...defaultProps} config={withHighlights}>
        <AuthPeek />
      </AuthProvider>,
    )
    await waitFor(() => expect(getText('hasHighlights')).toBe('true'))

    fireEvent.press(screen.getByTestId('signOut'))

    await waitFor(() => expect(getText('grantedPermissions')).toBe('null'))
    expect(mockMmkv.has(grantedPermissionsKey('u1'))).toBe(false)
    expect(mockMmkv.has(grantedPermissionsKey('u2'))).toBe(false)
  })
})

describe('AuthProvider — requestPermission', () => {
  const withHighlights: AuthConfig = { ...defaultConfig, permissions: [] }
  const storedTokens = {
    accessToken: 'stored-access',
    refreshToken: 'stored-refresh',
    expiryDate: new Date(Date.now() + 60 * 60 * 1000),
  }

  async function renderSignedIn() {
    mockMmkv.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify(adaUserInfo))
    mockLoadTokens.mockResolvedValue(storedTokens)
    render(
      <AuthProvider {...defaultProps} config={withHighlights}>
        <AuthPeek />
      </AuthProvider>,
    )
    await waitFor(() => expect(getText('isAuthenticated')).toBe('true'))
  }

  it('runs the data exchange with the signed-in user as initiator and records the grant', async () => {
    mockRequestPermission.mockResolvedValue({ kind: 'granted', permissions: ['highlights'] })
    await renderSignedIn()

    fireEvent.press(screen.getByTestId('requestPermission'))

    await waitFor(() => expect(getText('hasHighlights')).toBe('true'))
    expect(mockRequestPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        apiHost: 'api.example.com',
        appKey: 'appkey',
        accessToken: 'stored-access',
        redirectUri: 'https://app/cb',
        permissions: ['highlights'],
        initiatorUserId: 'u1',
      }),
    )
    expect(JSON.parse(getText('grantedPermissions'))).toEqual(['highlights'])
  })

  it('unions the grant into what sign-in already recorded', async () => {
    mockMmkv.set(
      grantedPermissionsKey('u1'),
      JSON.stringify({ userId: 'u1', permissions: ['votd'] }),
    )
    mockRequestPermission.mockResolvedValue({ kind: 'granted', permissions: ['highlights'] })
    await renderSignedIn()

    fireEvent.press(screen.getByTestId('requestPermission'))

    await waitFor(() => expect(getText('hasHighlights')).toBe('true'))
    expect(JSON.parse(getText('grantedPermissions'))).toEqual(['votd', 'highlights'])
  })

  it('records nothing when the exchange is cancelled', async () => {
    mockRequestPermission.mockResolvedValue({ kind: 'cancel' })
    await renderSignedIn()

    fireEvent.press(screen.getByTestId('requestPermission'))

    await waitFor(() => expect(getText('permissionOutcome')).toBe('{"kind":"cancel"}'))
    expect(getText('grantedPermissions')).toBe('null')
    expect(getText('error')).toBe('null')
  })

  it('records nothing when the exchange grants something else', async () => {
    mockRequestPermission.mockResolvedValue({ kind: 'granted', permissions: ['votd'] })
    await renderSignedIn()

    fireEvent.press(screen.getByTestId('requestPermission'))

    await waitFor(() => expect(JSON.parse(getText('grantedPermissions'))).toEqual(['votd']))
    expect(getText('hasHighlights')).toBe('false')
  })

  it('fails without opening a browser session when nobody is signed in', async () => {
    mockLoadTokens.mockResolvedValue(noStoredTokens)
    render(
      <AuthProvider {...defaultProps} config={withHighlights}>
        <AuthPeek />
      </AuthProvider>,
    )
    await waitFor(() => expect(getText('isLoading')).toBe('false'))

    fireEvent.press(screen.getByTestId('requestPermission'))

    await waitFor(() => expect(getText('permissionOutcome')).toMatch(/"kind":"failure"/))
    expect(mockRequestPermission).not.toHaveBeenCalled()
  })

  it('reads the CURRENT user when the session returns, not the one captured at render', async () => {
    mockRequestPermission.mockResolvedValue({ kind: 'granted', permissions: ['highlights'] })
    await renderSignedIn()

    fireEvent.press(screen.getByTestId('requestPermission'))
    await waitFor(() => expect(mockRequestPermission).toHaveBeenCalled())

    const { getCurrentUserId } = mockRequestPermission.mock.calls[0]![0] as {
      getCurrentUserId: () => string | null
    }
    expect(getCurrentUserId()).toBe('u1')

    fireEvent.press(screen.getByTestId('signOut'))
    await waitFor(() => expect(getText('isAuthenticated')).toBe('false'))
    expect(getCurrentUserId()).toBeNull()
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
    const highlightsKey = 'yvp.highlights.user-1.111.JHN.3'
    mockMmkv.set(
      highlightsKey,
      JSON.stringify([{ version_id: 111, passage_id: 'JHN.3.16', color: 'fffe00' }]),
    )
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
    expect(mockMmkv.has(highlightsKey)).toBe(false)
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
