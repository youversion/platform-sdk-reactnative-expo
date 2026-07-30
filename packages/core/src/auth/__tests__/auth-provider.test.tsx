import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useEffect, useState } from 'react'
import { AppState, Pressable, Text, View } from 'react-native'
import { getOrSetInstallationId } from '../../installation-id'
import type { AuthContextValue } from '../auth-context'
import AuthProvider from '../auth-provider'
import { MMKV_AUTH_KEYS } from '../constants'
import { requestDataExchange } from '../data-exchange'
import { createDataExchangeApi } from '../data-exchange-api'
import { refreshTokens, TokenEndpointError, type TokenResponse } from '../http'
import { signInWithPKCE } from '../pkce-flow'
import { loadTokens, saveTokens } from '../token-storage'
import type { AuthConfig, AuthPermission } from '../types'
import { useYVAuth } from '../use-yv-auth'

const mockMmkv = new Map<string, string>()
/** Keys whose native write/remove should throw, simulating an MMKV failure. */
const mockMmkvFailingKeys = new Set<string>()

jest.mock('../../storage/mmkv-storage', () => ({
  mmkvStorage: {
    set: jest.fn((k: string, v: string) => {
      if (mockMmkvFailingKeys.has(k)) {
        throw new Error(`mmkv write failed: ${k}`)
      }
      mockMmkv.set(k, v)
    }),
    getString: jest.fn((k: string) => mockMmkv.get(k)),
    remove: jest.fn((k: string) => {
      if (mockMmkvFailingKeys.has(k)) {
        throw new Error(`mmkv remove failed: ${k}`)
      }
      mockMmkv.delete(k)
    }),
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

jest.mock('../../installation-id', () => ({
  getOrSetInstallationId: jest.fn(() => Promise.resolve('inst-1')),
}))

// The grant flow itself is covered in data-exchange.test.ts; here we only care
// about what the provider hands it and what it does with the outcome — so no
// browser or API client is ever constructed.
jest.mock('../data-exchange', () => ({
  requestDataExchange: jest.fn(),
}))

jest.mock('../data-exchange-api', () => ({
  createDataExchangeApi: jest.fn(() => ({ mintToken: jest.fn() })),
}))

const mockLoadTokens = loadTokens as jest.Mock
const mockSaveTokens = saveTokens as jest.Mock
const mockRefreshTokens = refreshTokens as jest.Mock
const mockSignInWithPKCE = signInWithPKCE as jest.Mock
const mockRequestDataExchange = requestDataExchange as jest.Mock
const mockCreateDataExchangeApi = createDataExchangeApi as jest.Mock
const mockGetOrSetInstallationId = getOrSetInstallationId as jest.Mock
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

/**
 * Latest context value, so a test can drive `requestPermissions` with its own
 * permission list and hold the promise — the rendered button is fixed to
 * `['highlights']`, which cannot express two callers asking for different things.
 */
let latestAuth: AuthContextValue | null = null

function requestPermissionsFromContext(permissions: readonly AuthPermission[]) {
  if (latestAuth === null) {
    throw new Error('AuthPeek has not rendered yet')
  }
  return latestAuth.requestPermissions(permissions)
}

function AuthPeek() {
  const auth = useYVAuth()
  const [signInOutcome, setSignInOutcome] = useState<string>('idle')
  const [permissionOutcome, setPermissionOutcome] = useState<string>('idle')

  useEffect(() => {
    latestAuth = auth
  })

  return (
    <View>
      <Text testID="isLoading">{String(auth.isLoading)}</Text>
      <Text testID="isAuthenticated">{String(auth.isAuthenticated)}</Text>
      <Text testID="accessToken">{auth.accessToken ?? 'null'}</Text>
      <Text testID="userInfo">{auth.userInfo ? JSON.stringify(auth.userInfo) : 'null'}</Text>
      <Text testID="error">{auth.error?.message ?? 'null'}</Text>
      <Text testID="grantedPermissions">
        {auth.grantedPermissions ? JSON.stringify(auth.grantedPermissions) : 'null'}
      </Text>
      <Text testID="hasHighlights">{String(auth.hasPermission('highlights'))}</Text>
      <Text testID="signInOutcome">{signInOutcome}</Text>
      <Text testID="permissionOutcome">{permissionOutcome}</Text>
      <Pressable
        testID="requestPermissions"
        onPress={async () => {
          setPermissionOutcome(JSON.stringify(await auth.requestPermissions(['highlights'])))
        }}
      >
        <Text>requestPermissions</Text>
      </Pressable>
      <Pressable testID="invalidatePermissions" onPress={() => auth.invalidatePermissions()}>
        <Text>invalidatePermissions</Text>
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
  mockMmkvFailingKeys.clear()
  latestAuth = null
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
      grantedPermissions: null,
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

describe('AuthProvider — granted permissions', () => {
  const grantedKey = MMKV_AUTH_KEYS.grantedPermissions

  function renderProvider() {
    return render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )
  }

  function arrangeSignIn(grantedPermissions: string[] | null, userInfo = adaUserInfo) {
    mockLoadTokens.mockResolvedValue(noStoredTokens)
    mockSignInWithPKCE.mockResolvedValue({
      kind: 'success',
      tokens: validTokens,
      userInfo,
      grantedPermissions,
    })
  }

  async function signInAndSettle() {
    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    fireEvent.press(screen.getByTestId('signIn'))
    await waitFor(() => expect(getText('signInOutcome')).toBe('resolved'))
  }

  it('exposes a granted permission on the render after sign-in', async () => {
    arrangeSignIn(['highlights'])
    renderProvider()
    await signInAndSettle()

    expect(getText('hasHighlights')).toBe('true')
    expect(JSON.parse(getText('grantedPermissions'))).toEqual(['highlights'])
  })

  it('still reports the grant after a cold start (fresh provider, same storage)', async () => {
    arrangeSignIn(['highlights'])
    const { unmount } = renderProvider()
    await signInAndSettle()
    unmount()

    // Cold start: userInfo comes back from its own cache, and the grant is
    // seeded synchronously against it — true on the very first render.
    mockLoadTokens.mockResolvedValue({
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
      expiryDate: new Date(Date.now() + 60 * 60 * 1000),
    })
    renderProvider()

    expect(getText('hasHighlights')).toBe('true')
    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(JSON.parse(getText('grantedPermissions'))).toEqual(['highlights'])
  })

  it('reports a denied grant as [] — false, but distinguishable from never-requested', async () => {
    arrangeSignIn([])
    renderProvider()
    await signInAndSettle()

    expect(getText('hasHighlights')).toBe('false')
    expect(getText('grantedPermissions')).not.toBe('null')
    expect(JSON.parse(getText('grantedPermissions'))).toEqual([])
  })

  it('leaves a cached grant alone when a re-sign-in reports no granted_permissions', async () => {
    arrangeSignIn(['highlights'])
    renderProvider()
    await signInAndSettle()

    // A scopes-only re-auth on an already-signed-in user reports null
    // ("unknown"). It does not pass through clearAuthState, so writing null
    // through would silently wipe a real grant.
    arrangeSignIn(null)
    fireEvent.press(screen.getByTestId('signIn'))
    await waitFor(() => expect(mockSignInWithPKCE).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(getText('signInOutcome')).toBe('resolved'))

    expect(getText('hasHighlights')).toBe('true')
    expect(mockMmkv.get(grantedKey)).toBe(
      JSON.stringify({ userId: 'u1', permissions: ['highlights'] }),
    )
  })

  it('drops the previous user’s grant when a different user signs in without one', async () => {
    arrangeSignIn(['highlights'])
    renderProvider()
    await signInAndSettle()
    expect(getText('hasHighlights')).toBe('true')

    // Account switch inside one session: user B's redirect reports no
    // granted_permissions ("unknown"). Preserving on null is only correct for
    // the same user — here it would hand Ada's grant to Grace.
    const graceUserInfo = { id: 'u2', name: 'Grace', email: undefined, avatarUrl: undefined }
    arrangeSignIn(null, graceUserInfo)
    fireEvent.press(screen.getByTestId('signIn'))
    await waitFor(() => expect(mockSignInWithPKCE).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(getText('signInOutcome')).toBe('resolved'))

    expect(JSON.parse(getText('userInfo')).id).toBe('u2')
    expect(getText('hasHighlights')).toBe('false')
    expect(getText('grantedPermissions')).toBe('null')
    expect(mockMmkv.has(grantedKey)).toBe(false)
  })

  it('does not persist a grant when the session fails to commit', async () => {
    arrangeSignIn(['highlights'])
    renderProvider()
    // Queue the rejection only after mount: bootstrap's clearAuthState calls
    // saveTokens too, and would otherwise swallow it.
    await waitFor(() => expect(getText('isLoading')).toBe('false'))

    // The keychain write inside setAuthState rejects, so the sign-in never
    // takes hold — no grant may outlive it, in state or in MMKV.
    mockSaveTokens.mockRejectedValueOnce(new Error('keychain unavailable'))
    fireEvent.press(screen.getByTestId('signIn'))
    await waitFor(() => expect(getText('signInOutcome')).toBe('rejected: keychain unavailable'))

    expect(getText('grantedPermissions')).toBe('null')
    expect(getText('hasHighlights')).toBe('false')
    expect(mockMmkv.has(grantedKey)).toBe(false)
  })

  it('still completes sign-in and publishes the grant when the cache write throws', async () => {
    arrangeSignIn(['highlights'])
    renderProvider()
    await waitFor(() => expect(getText('isLoading')).toBe('false'))

    // The grant cache only seeds the first render, so a native storage failure
    // must not reject a sign-in whose session already committed — nor skip the
    // in-memory update that hasPermission actually reads.
    mockMmkvFailingKeys.add(grantedKey)
    fireEvent.press(screen.getByTestId('signIn'))
    await waitFor(() => expect(getText('signInOutcome')).toBe('resolved'))

    expect(getText('isAuthenticated')).toBe('true')
    expect(getText('hasHighlights')).toBe('true')
    expect(mockMmkv.has(grantedKey)).toBe(false)
  })

  it('still drops the previous user’s grant when the cache removal throws', async () => {
    arrangeSignIn(['highlights'])
    renderProvider()
    await signInAndSettle()

    // Same guarantee on the account-switch path: a failed remove must not strand
    // Ada's grant in memory for Grace, nor reject Grace's committed sign-in.
    mockMmkvFailingKeys.add(grantedKey)
    arrangeSignIn(null, { id: 'u2', name: 'Grace', email: undefined, avatarUrl: undefined })
    fireEvent.press(screen.getByTestId('signIn'))
    await waitFor(() => expect(mockSignInWithPKCE).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(getText('signInOutcome')).toBe('resolved'))

    expect(getText('isAuthenticated')).toBe('true')
    expect(getText('hasHighlights')).toBe('false')
    expect(getText('grantedPermissions')).toBe('null')
  })

  it('reads a cached grant belonging to another user as a miss', async () => {
    mockMmkv.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify(adaUserInfo))
    mockMmkv.set(
      grantedKey,
      JSON.stringify({ userId: 'someone-else', permissions: ['highlights'] }),
    )
    mockLoadTokens.mockResolvedValue({
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
      expiryDate: new Date(Date.now() + 60 * 60 * 1000),
    })

    renderProvider()
    await waitFor(() => expect(getText('isLoading')).toBe('false'))

    expect(getText('hasHighlights')).toBe('false')
    expect(getText('grantedPermissions')).toBe('null')
  })

  it('purges the stored grant on sign-out', async () => {
    arrangeSignIn(['highlights'])
    renderProvider()
    await signInAndSettle()
    expect(mockMmkv.has(grantedKey)).toBe(true)

    fireEvent.press(screen.getByTestId('signOut'))

    await waitFor(() => expect(getText('isAuthenticated')).toBe('false'))
    expect(getText('grantedPermissions')).toBe('null')
    expect(getText('hasHighlights')).toBe('false')
    expect(mockMmkv.has(grantedKey)).toBe(false)
  })

  it('invalidatePermissions drops both the state and the cached entry', async () => {
    arrangeSignIn(['highlights'])
    renderProvider()
    await signInAndSettle()

    await act(async () => {
      fireEvent.press(screen.getByTestId('invalidatePermissions'))
    })

    expect(getText('grantedPermissions')).toBe('null')
    expect(getText('hasHighlights')).toBe('false')
    expect(mockMmkv.has(grantedKey)).toBe(false)
    // Still signed in — only the grant was invalidated.
    expect(getText('isAuthenticated')).toBe('true')
  })
})

describe('AuthProvider — requestPermissions', () => {
  function renderProvider() {
    return render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )
  }

  async function signInWithGrant(grantedPermissions: string[] | null) {
    mockLoadTokens.mockResolvedValue(noStoredTokens)
    mockSignInWithPKCE.mockResolvedValue({
      kind: 'success',
      tokens: validTokens,
      userInfo: adaUserInfo,
      grantedPermissions,
    })
    renderProvider()
    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    fireEvent.press(screen.getByTestId('signIn'))
    await waitFor(() => expect(getText('signInOutcome')).toBe('resolved'))
  }

  async function pressRequestPermissions() {
    fireEvent.press(screen.getByTestId('requestPermissions'))
    await waitFor(() => expect(getText('permissionOutcome')).not.toBe('idle'))
    return JSON.parse(getText('permissionOutcome'))
  }

  it('fails with not-signed-in without minting a token when there is no access token', async () => {
    mockLoadTokens.mockResolvedValue(noStoredTokens)
    renderProvider()
    await waitFor(() => expect(getText('isLoading')).toBe('false'))

    expect(await pressRequestPermissions()).toMatchObject({
      status: 'failure',
      reason: 'not-signed-in',
    })
    // A mint on a signed-out user would 401, and that 401 reads as
    // "not permitted", which is a different and wrong story.
    expect(mockCreateDataExchangeApi).not.toHaveBeenCalled()
    expect(mockRequestDataExchange).not.toHaveBeenCalled()
  })

  it('flips hasPermission on the next render when the grant lands', async () => {
    // Signed in having declined highlights: the exact state this flow exists for.
    await signInWithGrant([])
    expect(getText('hasHighlights')).toBe('false')

    mockRequestDataExchange.mockResolvedValue({
      status: 'granted',
      grantedPermissions: ['highlights'],
    })

    expect(await pressRequestPermissions()).toEqual({
      status: 'granted',
      grantedPermissions: ['highlights'],
    })
    expect(getText('hasHighlights')).toBe('true')
  })

  it('merges the new grant into the existing one rather than replacing it', async () => {
    await signInWithGrant(['votd'])

    mockRequestDataExchange.mockResolvedValue({
      status: 'granted',
      grantedPermissions: ['highlights'],
    })
    await pressRequestPermissions()

    expect(JSON.parse(getText('grantedPermissions'))).toEqual(['votd', 'highlights'])
  })

  it('hands the flow the current token, the initiator id, and the requested permissions', async () => {
    await signInWithGrant(null)

    mockRequestDataExchange.mockResolvedValue({ status: 'cancel' })
    await pressRequestPermissions()

    expect(mockCreateDataExchangeApi).toHaveBeenCalledWith({
      appKey: 'appkey',
      apiHost: 'api.example.com',
      installationId: 'inst-1',
    })
    expect(mockRequestDataExchange).toHaveBeenCalledWith(
      expect.objectContaining({
        appKey: 'appkey',
        apiHost: 'api.example.com',
        accessToken: 'new-access',
        initiator: expect.objectContaining({ userId: 'u1' }),
        permissions: ['highlights'],
      }),
    )
  })

  it('gives the flow a getCurrentIdentity that sees a sign-out that happened mid-flow', async () => {
    await signInWithGrant(['highlights'])

    mockRequestDataExchange.mockResolvedValue({ status: 'cancel' })
    await pressRequestPermissions()

    const { initiator, getCurrentIdentity } = mockRequestDataExchange.mock.calls[0][0] as {
      initiator: { epoch: number; userId: string | null }
      getCurrentIdentity: () => { epoch: number; userId: string | null }
    }
    expect(getCurrentIdentity()).toEqual(initiator)

    fireEvent.press(screen.getByTestId('signOut'))
    await waitFor(() => expect(getText('isAuthenticated')).toBe('false'))

    // Reading a captured closure would still say 'u1' here, and the initiator
    // guard would wave a grant through for a user who has left.
    expect(getCurrentIdentity().userId).toBeNull()
    expect(getCurrentIdentity().epoch).not.toBe(initiator.epoch)
  })

  it('moves the epoch on sign-out but not on a token refresh', async () => {
    await signInWithGrant(null)

    mockRequestDataExchange.mockResolvedValue({ status: 'cancel' })
    await pressRequestPermissions()
    const { getCurrentIdentity } = mockRequestDataExchange.mock.calls[0][0] as {
      getCurrentIdentity: () => { epoch: number; userId: string | null }
    }
    const atSignIn = getCurrentIdentity().epoch

    // A refresh is the same person with a new token — the guard must not fire.
    mockRefreshTokens.mockResolvedValue(validTokens)
    await act(async () => {
      fireAppStateChange('active')
    })
    expect(getCurrentIdentity().epoch).toBe(atSignIn)

    fireEvent.press(screen.getByTestId('signOut'))
    await waitFor(() => expect(getText('isAuthenticated')).toBe('false'))
    expect(getCurrentIdentity().epoch).not.toBe(atSignIn)
  })

  it('leaves the grant untouched on a cancel', async () => {
    await signInWithGrant(['votd'])

    mockRequestDataExchange.mockResolvedValue({ status: 'cancel' })
    expect(await pressRequestPermissions()).toEqual({ status: 'cancel' })

    expect(JSON.parse(getText('grantedPermissions'))).toEqual(['votd'])
  })

  it('leaves the grant untouched when the return is granted but empty', async () => {
    await signInWithGrant(null)

    mockRequestDataExchange.mockResolvedValue({ status: 'granted', grantedPermissions: [] })
    await pressRequestPermissions()

    expect(getText('grantedPermissions')).toBe('null')
  })

  it('resolves to a transient failure when reading the installation id rejects', async () => {
    await signInWithGrant(null)

    // Native state read, so it can genuinely fail. `requestPermissions` is
    // documented to resolve rather than throw, and a consumer following that
    // contract has no catch to land in.
    mockGetOrSetInstallationId.mockRejectedValueOnce(new Error('no installation id'))

    expect(await pressRequestPermissions()).toEqual({
      status: 'failure',
      reason: 'transient',
      message: 'no installation id',
    })
    expect(mockRequestDataExchange).not.toHaveBeenCalled()
  })

  it('shares one in-flight flow across overlapping calls instead of opening a second session', async () => {
    await signInWithGrant(null)

    // A double-tap. Left unguarded this mints a second token and opens a second
    // auth session — which on Android rejects outright ("WebBrowser is already
    // open"), and either way races the first to write the grant cache.
    let settle = (_outcome: unknown) => {}
    mockRequestDataExchange.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve
      }),
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId('requestPermissions'))
    })
    expect(mockRequestDataExchange).toHaveBeenCalledTimes(1)

    // Second tap while the first flow is still awaiting the browser.
    await act(async () => {
      fireEvent.press(screen.getByTestId('requestPermissions'))
    })
    expect(mockRequestDataExchange).toHaveBeenCalledTimes(1)
    expect(mockCreateDataExchangeApi).toHaveBeenCalledTimes(1)

    await act(async () => {
      settle({ status: 'granted', grantedPermissions: ['highlights'] })
    })
    expect(getText('hasHighlights')).toBe('true')

    // The lock releases with the promise, so the next gesture is a fresh flow.
    mockRequestDataExchange.mockResolvedValue({ status: 'cancel' })
    await pressRequestPermissions()
    expect(mockRequestDataExchange).toHaveBeenCalledTimes(2)
  })

  it('refuses a concurrent request for different permissions instead of handing it the wrong outcome', async () => {
    await signInWithGrant(null)

    let settle = (_outcome: unknown) => {}
    mockRequestDataExchange.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve
      }),
    )

    // First caller asks for highlights and is still in the consent page.
    const first = requestPermissionsFromContext(['highlights'])
    await act(async () => {})
    expect(mockRequestDataExchange).toHaveBeenCalledTimes(1)

    // A second caller asks for something else. Sharing the first promise would
    // report `granted` for a consent page that never mentioned votd, and leave
    // the caller no reason to retry.
    const second = await act(async () => requestPermissionsFromContext(['votd']))
    expect(second).toMatchObject({ status: 'failure', reason: 'transient' })
    expect(mockRequestDataExchange).toHaveBeenCalledTimes(1)

    await act(async () => {
      settle({ status: 'granted', grantedPermissions: ['highlights'] })
    })
    expect(await first).toEqual({ status: 'granted', grantedPermissions: ['highlights'] })
  })

  it('shares the flow when a concurrent request asks for the same permissions in a different order', async () => {
    await signInWithGrant(null)

    let settle = (_outcome: unknown) => {}
    mockRequestDataExchange.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve
      }),
    )

    const first = requestPermissionsFromContext(['highlights', 'votd'])
    await act(async () => {})
    const second = requestPermissionsFromContext(['votd', 'highlights'])
    await act(async () => {})

    // Same consent, so it is a double-tap rather than a competing request.
    expect(mockRequestDataExchange).toHaveBeenCalledTimes(1)

    await act(async () => {
      settle({ status: 'granted', grantedPermissions: ['highlights', 'votd'] })
    })
    expect(await second).toEqual(await first)
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
