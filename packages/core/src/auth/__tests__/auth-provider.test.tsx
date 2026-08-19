import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { useEffect, useState } from 'react'
import { AppState, Pressable, Text, View } from 'react-native'
import { getCachedHighlights, setCachedHighlights } from '../../highlights/cache'
import type { HighlightScope } from '../../highlights/constants'
import { enqueueWrites, listQueuedScopes } from '../../highlights/queue'
import * as installationId from '../../installation-id'
import { mmkvStorage } from '../../storage/mmkv-storage'
import type { AuthContextValue } from '../auth-context'
import { AuthProvider } from '../auth-provider'
import { MMKV_AUTH_KEYS } from '../constants'
import * as dataExchange from '../data-exchange'
import type { DataExchangeOutcome } from '../data-exchange'
import * as dataExchangeApi from '../data-exchange-api'
import * as http from '../http'
import { TokenEndpointError, type TokenResponse } from '../http'
import * as pkceFlow from '../pkce-flow'
import * as tokenStorage from '../token-storage'
import type { AuthConfig, AuthPermission } from '../types'
import { useYVAuth } from '../use-yv-auth'

let mockMmkvThrows = false
let mockLoadTokens: jest.SpiedFunction<typeof tokenStorage.loadTokens>
let mockSaveTokens: jest.SpiedFunction<typeof tokenStorage.saveTokens>
let mockRefreshTokens: jest.SpiedFunction<typeof http.refreshTokens>
let mockSignInWithPKCE: jest.SpiedFunction<typeof pkceFlow.signInWithPKCE>
let mockRequestDataExchange: jest.SpiedFunction<typeof dataExchange.requestDataExchange>
let mockCreateDataExchangeApi: jest.SpiedFunction<typeof dataExchangeApi.createDataExchangeApi>
let mockGetOrSetInstallationId: jest.SpiedFunction<typeof installationId.getOrSetInstallationId>
let mockAppStateAddEventListener: jest.SpiedFunction<typeof AppState.addEventListener>

const defaultConfig: AuthConfig = { redirectUri: 'https://app/cb' }
const defaultProps = { config: defaultConfig, appKey: 'appkey', apiHost: 'api.example.com' }

type JwtClaims = {
  sub?: string
  name?: string
}

function makeJwt(payload: JwtClaims): string {
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

const JHN3: HighlightScope = { versionId: 111, book: 'JHN', chapter: '3' }
const GEN1: HighlightScope = { versionId: 111, book: 'GEN', chapter: '1' }
const PSA23: HighlightScope = { versionId: 111, book: 'PSA', chapter: '23' }

function parkWrite(userId: string, scope: HighlightScope): void {
  enqueueWrites({ userId, scope, verses: [16], color: 'fffe00', currentColors: {} })
}

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
  const [signOutOutcome, setSignOutOutcome] = useState<string>('idle')
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
      <Text testID="signOutOutcome">{signOutOutcome}</Text>
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
            setSignInOutcome(`rejected: ${e instanceof Error ? e.message : String(e)}`)
          }
        }}
      >
        <Text>signIn</Text>
      </Pressable>
      <Pressable
        testID="signOut"
        onPress={async () => {
          setSignOutOutcome('pending')
          try {
            await auth.signOut()
            setSignOutOutcome('resolved')
          } catch (e) {
            setSignOutOutcome(`rejected: ${e instanceof Error ? e.message : String(e)}`)
          }
        }}
      >
        <Text>signOut</Text>
      </Pressable>
    </View>
  )
}

function getText(id: string): string {
  const children = screen.getByTestId(id).props.children
  return Array.isArray(children) ? children.join('') : String(children ?? '')
}

function fireAppStateChange(state: string) {
  const handler = mockAppStateAddEventListener.mock.calls.at(-1)?.[1]
  expect(handler).toEqual(expect.any(Function))
  handler?.(state)
}

beforeEach(() => {
  mmkvStorage.clearAll()
  mockMmkvThrows = false
  latestAuth = null

  const originalRemove = mmkvStorage.remove.bind(mmkvStorage)
  const originalGetAllKeys = mmkvStorage.getAllKeys.bind(mmkvStorage)
  jest.spyOn(mmkvStorage, 'remove').mockImplementation((key) => {
    if (mockMmkvThrows) throw new Error('mmkv unavailable')
    return originalRemove(key)
  })
  jest.spyOn(mmkvStorage, 'getAllKeys').mockImplementation(() => {
    if (mockMmkvThrows) throw new Error('mmkv unavailable')
    return originalGetAllKeys()
  })

  mockLoadTokens = jest.spyOn(tokenStorage, 'loadTokens')
  mockSaveTokens = jest.spyOn(tokenStorage, 'saveTokens').mockResolvedValue(undefined)
  mockRefreshTokens = jest.spyOn(http, 'refreshTokens')
  mockSignInWithPKCE = jest.spyOn(pkceFlow, 'signInWithPKCE')
  mockRequestDataExchange = jest.spyOn(dataExchange, 'requestDataExchange')
  mockCreateDataExchangeApi = jest
    .spyOn(dataExchangeApi, 'createDataExchangeApi')
    .mockReturnValue({ mintToken: jest.fn() })
  mockGetOrSetInstallationId = jest
    .spyOn(installationId, 'getOrSetInstallationId')
    .mockReturnValue('inst-1')
  mockAppStateAddEventListener = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation(() => ({ remove: jest.fn() }))
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('AuthProvider — mount', () => {
  it('clears stale cached userInfo when no tokens are stored', async () => {
    mmkvStorage.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify({ id: 'stale-user' }))
    mockLoadTokens.mockResolvedValue(noStoredTokens)

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )

    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(getText('isAuthenticated')).toBe('false')
    expect(getText('userInfo')).toBe('null')
    expect(mmkvStorage.contains(MMKV_AUTH_KEYS.cachedUserInfo)).toBe(false)
    expect(mockRefreshTokens).not.toHaveBeenCalled()
  })

  // A purge that could not take leaves the record readable, so the next mount
  // seeds the departed user. The bootstrap clear is what bounds that — no write
  // into a store refusing writes can — so pin it.
  it('drops a cached userInfo the store still refuses to remove', async () => {
    mmkvStorage.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify(adaUserInfo))
    mmkvStorage.set(
      MMKV_AUTH_KEYS.grantedPermissions,
      JSON.stringify({ userId: 'u1', permissions: ['highlights'] }),
    )
    mockLoadTokens.mockResolvedValue(noStoredTokens)
    mockMmkvThrows = true

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )

    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(getText('userInfo')).toBe('null')
    expect(getText('grantedPermissions')).toBe('null')
    expect(getText('isAuthenticated')).toBe('false')
    // The record itself survives: the accepted residual, not the exposure.
    expect(mmkvStorage.contains(MMKV_AUTH_KEYS.cachedUserInfo)).toBe(true)
  })

  // The sibling case, and the reason bootstrap does not pass
  // `abortOnTokenFailure`. There are no tokens to clear here — the whole branch
  // is "nothing stored" — so a Keychain that rejects that defensive write must
  // not cost the identity drop ADR 0014 names as the bound.
  it('drops a cached userInfo even when the token clear rejects', async () => {
    mmkvStorage.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify(adaUserInfo))
    mmkvStorage.set(
      MMKV_AUTH_KEYS.grantedPermissions,
      JSON.stringify({ userId: 'u1', permissions: ['highlights'] }),
    )
    mockLoadTokens.mockResolvedValue(noStoredTokens)
    mockSaveTokens.mockRejectedValueOnce(new Error('keychain unavailable'))

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )

    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(getText('userInfo')).toBe('null')
    expect(getText('grantedPermissions')).toBe('null')
    expect(getText('isAuthenticated')).toBe('false')
    // The purges ran too — the rejection was swallowed, not propagated.
    expect(mmkvStorage.contains(MMKV_AUTH_KEYS.cachedUserInfo)).toBe(false)
  })

  it('hydrates state from stored tokens and skips refresh when not near expiry', async () => {
    mmkvStorage.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify(adaUserInfo))
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
    mmkvStorage.set(
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
    mmkvStorage.set(
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
    mmkvStorage.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify(null))
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
  it('clears tokens, resets in-memory state, and removes cached userInfo, highlights and queued writes', async () => {
    mmkvStorage.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify({ id: 'u1' }))
    setCachedHighlights('u1', JHN3, [{ version_id: 111, passage_id: 'JHN.3.16', color: 'fffe00' }])
    parkWrite('u1', JHN3)
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
    expect(mmkvStorage.contains(MMKV_AUTH_KEYS.cachedUserInfo)).toBe(false)
    expect(getCachedHighlights('u1', JHN3)).toBeNull()
    expect(listQueuedScopes('u1')).toEqual([])
  })

  // Every user's entries, like the highlights cache: one user is signed in at a
  // time, so anything under another id was already left by a departure.
  it('leaves no queued write behind, for any chapter or any user', async () => {
    parkWrite('u1', JHN3)
    parkWrite('u1', GEN1)
    parkWrite('u2', PSA23)
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
    expect(listQueuedScopes('u1')).toEqual([])
    expect(listQueuedScopes('u2')).toEqual([])
  })

  // The purges run after the tokens are cleared, and swallow their own failures.
  // A store that throws must cost a surviving cache entry, never a user who asked
  // to sign out and stayed in.
  it('still signs out when the cache purges cannot reach the store', async () => {
    mmkvStorage.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify({ id: 'u1' }))
    parkWrite('u1', JHN3)
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

    mockMmkvThrows = true
    fireEvent.press(screen.getByTestId('signOut'))

    await waitFor(() => expect(getText('isAuthenticated')).toBe('false'))
    expect(getText('accessToken')).toBe('null')
    expect(getText('userInfo')).toBe('null')
    expect(mockSaveTokens).toHaveBeenCalledWith({
      accessToken: null,
      refreshToken: null,
      expiryDate: null,
    })
  })

  // The token clear runs first precisely so this case aborts loudly. A Keychain
  // that refuses the write leaves the session on disk, so the app has to keep
  // saying "signed in" — purge the caches anyway and the user sees a signed-out
  // app whose session comes back on the next launch.
  it('aborts the whole sign-out, caches included, when the token clear rejects', async () => {
    mmkvStorage.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify({ id: 'u1', name: 'Ada' }))
    mmkvStorage.set(
      MMKV_AUTH_KEYS.grantedPermissions,
      JSON.stringify({ userId: 'u1', permissions: ['highlights'] }),
    )
    setCachedHighlights('u1', JHN3, [{ version_id: 111, passage_id: 'JHN.3.16', color: 'fffe00' }])
    parkWrite('u1', JHN3)
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

    mockSaveTokens.mockRejectedValueOnce(new Error('keychain unavailable'))
    fireEvent.press(screen.getByTestId('signOut'))

    // Loud: signOut is the one path allowed to reject, so the caller can tell the
    // user their session is still live.
    await waitFor(() => expect(getText('signOutOutcome')).toBe('rejected: keychain unavailable'))
    expect(getText('isAuthenticated')).toBe('true')
    expect(getText('accessToken')).toBe('a')
    expect(JSON.parse(getText('userInfo')).id).toBe('u1')
    expect(getText('hasHighlights')).toBe('true')

    // Nothing downstream of the token clear ran.
    expect(mmkvStorage.contains(MMKV_AUTH_KEYS.cachedUserInfo)).toBe(true)
    expect(mmkvStorage.contains(MMKV_AUTH_KEYS.grantedPermissions)).toBe(true)
    expect(getCachedHighlights('u1', JHN3)).not.toBeNull()
    expect(listQueuedScopes('u1')).toHaveLength(1)
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
    setCachedHighlights('user-1', JHN3, [
      { version_id: 111, passage_id: 'JHN.3.16', color: 'fffe00' },
    ])
    parkWrite('user-1', JHN3)
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
    expect(getCachedHighlights('user-1', JHN3)).toBeNull()
    expect(listQueuedScopes('user-1')).toEqual([])
  })

  // The revocation is the server's, not a gesture anyone can retry, so this path
  // passes no `abortOnTokenFailure`. Aborting would leave the departed user's
  // highlights painted on top of a session that is already over.
  it('still purges the caches when the revoked session cannot clear its tokens', async () => {
    mmkvStorage.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify(adaUserInfo))
    setCachedHighlights('user-1', JHN3, [
      { version_id: 111, passage_id: 'JHN.3.16', color: 'fffe00' },
    ])
    parkWrite('user-1', JHN3)
    mockLoadTokens.mockResolvedValue(expiredStored)
    mockRefreshTokens.mockRejectedValue(new TokenEndpointError(401, 'invalid_grant'))
    // Only the clearing write rejects. Bootstrap hydrates through `setAuthState`
    // first, and a blanket rejection would fail that instead, never reaching the
    // revoked branch this case is about.
    mockSaveTokens.mockImplementation(async (tokens: { refreshToken: string | null }) => {
      if (tokens.refreshToken === null) {
        throw new Error('keychain unavailable')
      }
    })

    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )

    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(getText('isAuthenticated')).toBe('false')
    expect(getText('accessToken')).toBe('null')
    expect(getText('userInfo')).toBe('null')
    expect(getCachedHighlights('user-1', JHN3)).toBeNull()
    expect(listQueuedScopes('user-1')).toEqual([])
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

  it('joins an in-flight refresh instead of resolving on the stale token', async () => {
    mockLoadTokens.mockResolvedValue({
      accessToken: 'expired-access',
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

    // Bootstrap's refresh is in flight and deliberately left unresolved, which
    // is the ordinary case this guards: the app foregrounds, a refresh starts,
    // and the user acts before it lands.
    await waitFor(() => expect(mockRefreshTokens).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(latestAuth).not.toBeNull())

    let joined = false
    const joiner = latestAuth!.getAccessToken().then(() => {
      joined = true
    })

    // Drain the microtask queue. A caller that skipped the in-flight refresh
    // rather than joining it would have settled by now, and its pre-flight would
    // have read the expired token.
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(joined).toBe(false)
    expect(getText('accessToken')).toBe('expired-access')

    await act(async () => {
      resolveRefresh(validTokens)
      await joiner
    })

    expect(joined).toBe(true)
    expect(getText('accessToken')).toBe('new-access')
    // Joining, not starting a second one.
    expect(mockRefreshTokens).toHaveBeenCalledTimes(1)
  })
})

describe('AuthProvider — getAccessToken', () => {
  const clearedTokens = { accessToken: null, refreshToken: null, expiryDate: null }

  function renderProvider() {
    return render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )
  }

  it('resolves ok with the current token, with no refresh call, when it is beyond the leeway', async () => {
    mockLoadTokens.mockResolvedValue({
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
      expiryDate: new Date(Date.now() + 60 * 60 * 1000),
    })

    renderProvider()
    await waitFor(() => expect(getText('isLoading')).toBe('false'))

    const result = await act(async () => latestAuth!.getAccessToken())

    expect(result).toEqual({ status: 'ok', token: 'stored-access', userId: null })
    expect(mockRefreshTokens).not.toHaveBeenCalled()
  })

  it('refreshes an expired token and resolves ok with the new one', async () => {
    mockLoadTokens.mockResolvedValue({
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
      expiryDate: new Date(Date.now() - 1000),
    })
    // Bootstrap's refresh lands a token that is *still* at expiry, so the
    // accessor's own leeway check genuinely triggers the second refresh.
    mockRefreshTokens.mockResolvedValueOnce({
      ...validTokens,
      access_token: 'still-stale',
      expires_in: '0',
    })
    renderProvider()
    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(mockRefreshTokens).toHaveBeenCalledTimes(1)

    mockRefreshTokens.mockResolvedValueOnce({ ...validTokens, access_token: 'fresh-access' })
    const result = await act(async () => latestAuth!.getAccessToken())

    expect(result).toEqual({ status: 'ok', token: 'fresh-access', userId: null })
    expect(mockRefreshTokens).toHaveBeenCalledTimes(2)
  })

  it('reports refresh-failed on a transient refresh error, keeping tokens and the session', async () => {
    mockLoadTokens.mockResolvedValue({
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
      expiryDate: new Date(Date.now() - 1000),
    })
    mockRefreshTokens.mockRejectedValue(new Error('Network request failed'))

    renderProvider()
    await waitFor(() => expect(getText('isLoading')).toBe('false'))

    const result = await act(async () => latestAuth!.getAccessToken())

    // The line the highlights write path branches on: still signed in, token
    // just not fresh — a retryable condition, not a sign-out.
    expect(result).toEqual({ status: 'unavailable', reason: 'refresh-failed' })
    expect(getText('isAuthenticated')).toBe('true')
    expect(getText('accessToken')).toBe('stored-access')
    expect(mockSaveTokens).not.toHaveBeenCalledWith(clearedTokens)
  })

  // The leeway triggers the refresh; it does not decide usable. A token 30s from
  // expiry still works, so a failed refresh must hand it over, not refuse it.
  it('resolves ok with a token inside the leeway window that the refresh could not replace', async () => {
    mockLoadTokens.mockResolvedValue({
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
      expiryDate: new Date(Date.now() + 30 * 1000),
    })
    mockRefreshTokens.mockRejectedValue(new Error('Network request failed'))

    renderProvider()
    await waitFor(() => expect(getText('isLoading')).toBe('false'))

    const result = await act(async () => latestAuth!.getAccessToken())

    expect(result).toEqual({ status: 'ok', token: 'stored-access', userId: null })
    // Pins the failed-refresh path, not the fresh-token shortcut.
    expect(mockRefreshTokens).toHaveBeenCalled()
  })

  it('reports signed-out when the refresh finds the token revoked and clears the session', async () => {
    mockLoadTokens.mockResolvedValue({
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
      expiryDate: new Date(Date.now() - 1000),
    })
    // Bootstrap keeps the token stale; the accessor's refresh hits the revocation.
    mockRefreshTokens
      .mockResolvedValueOnce({ ...validTokens, access_token: 'still-stale', expires_in: '0' })
      .mockRejectedValueOnce(new TokenEndpointError(401, 'invalid_grant'))

    renderProvider()
    await waitFor(() => expect(getText('isLoading')).toBe('false'))

    const result = await act(async () => latestAuth!.getAccessToken())

    expect(result).toEqual({ status: 'unavailable', reason: 'signed-out' })
    expect(getText('isAuthenticated')).toBe('false')
    expect(mockSaveTokens).toHaveBeenCalledWith(clearedTokens)
  })

  it('reports signed-out without a network call when no refresh token is stored', async () => {
    mockLoadTokens.mockResolvedValue(noStoredTokens)

    renderProvider()
    await waitFor(() => expect(getText('isLoading')).toBe('false'))

    const result = await act(async () => latestAuth!.getAccessToken())

    expect(result).toEqual({ status: 'unavailable', reason: 'signed-out' })
    expect(mockRefreshTokens).not.toHaveBeenCalled()
  })

  // The pairing a caller with a captured identity relies on: the token and the
  // id of whoever owns it come from the same read, so a sign-in that lands while
  // the caller is awaiting cannot hand it a token attributed to the old user.
  it('reports the signed-in user alongside the token, updated by a sign-in as somebody else', async () => {
    mmkvStorage.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify(adaUserInfo))
    mockLoadTokens.mockResolvedValue({
      accessToken: 'ada-access',
      refreshToken: 'ada-refresh',
      expiryDate: new Date(Date.now() + 60 * 60 * 1000),
    })

    renderProvider()
    await waitFor(() => expect(getText('isLoading')).toBe('false'))

    expect(await act(async () => latestAuth!.getAccessToken())).toEqual({
      status: 'ok',
      token: 'ada-access',
      userId: 'u1',
    })

    mockSignInWithPKCE.mockResolvedValue({
      kind: 'success',
      tokens: { ...validTokens, access_token: 'grace-access' },
      userInfo: { id: 'u2', name: 'Grace' },
      grantedPermissions: null,
    })
    await userEvent.press(screen.getByTestId('signIn'))
    await waitFor(() => expect(getText('signInOutcome')).toBe('resolved'))

    expect(await act(async () => latestAuth!.getAccessToken())).toEqual({
      status: 'ok',
      token: 'grace-access',
      userId: 'u2',
    })
  })

  it('force:true hits the endpoint even when the token is beyond leeway', async () => {
    mockLoadTokens.mockResolvedValue({
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
      expiryDate: new Date(Date.now() + 60 * 60 * 1000),
    })
    mockRefreshTokens.mockResolvedValue({ ...validTokens, access_token: 'forced-access' })

    renderProvider()
    await waitFor(() => expect(getText('isLoading')).toBe('false'))

    const result = await act(async () => latestAuth!.getAccessToken({ force: true }))

    expect(result).toEqual({ status: 'ok', token: 'forced-access', userId: null })
    expect(mockRefreshTokens).toHaveBeenCalled()
  })

  it('force:true reports refresh-failed when the mint does not land, even if a leftover is unexpired', async () => {
    mockLoadTokens.mockResolvedValue({
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
      expiryDate: new Date(Date.now() + 60 * 60 * 1000),
    })
    mockRefreshTokens.mockRejectedValue(new Error('Network request failed'))

    renderProvider()
    await waitFor(() => expect(getText('isLoading')).toBe('false'))

    const result = await act(async () => latestAuth!.getAccessToken({ force: true }))

    expect(result).toEqual({ status: 'unavailable', reason: 'refresh-failed' })
    expect(getText('isAuthenticated')).toBe('true')
    expect(getText('accessToken')).toBe('stored-access')
    expect(mockSaveTokens).not.toHaveBeenCalledWith(clearedTokens)
  })

  it('joins an in-flight refresh: concurrent callers share one HTTP call and get the new token', async () => {
    mockLoadTokens.mockResolvedValue({
      accessToken: 'expired-access',
      refreshToken: 'r',
      expiryDate: new Date(Date.now() - 1000),
    })

    let resolveRefresh: (v: TokenResponse) => void = () => {}
    mockRefreshTokens.mockReturnValue(
      new Promise<TokenResponse>((r) => {
        resolveRefresh = r
      }),
    )

    renderProvider()

    // Bootstrap's refresh is in flight and held open; both accessor calls must
    // join it rather than resolve on the expired token or start a second call.
    await waitFor(() => expect(mockRefreshTokens).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(latestAuth).not.toBeNull())

    const first = latestAuth!.getAccessToken()
    const second = latestAuth!.getAccessToken()

    await act(async () => {
      resolveRefresh(validTokens)
      await Promise.all([first, second])
    })

    expect(await first).toEqual({ status: 'ok', token: 'new-access', userId: null })
    expect(await second).toEqual({ status: 'ok', token: 'new-access', userId: null })
    expect(mockRefreshTokens).toHaveBeenCalledTimes(1)
  })

  it('force:true remints after joining an in-flight refresh', async () => {
    mockLoadTokens.mockResolvedValue({
      accessToken: 'expired-access',
      refreshToken: 'r',
      expiryDate: new Date(Date.now() - 1000),
    })

    let resolveFirst: (v: TokenResponse) => void = () => {}
    mockRefreshTokens
      .mockImplementationOnce(
        () =>
          new Promise<TokenResponse>((r) => {
            resolveFirst = r
          }),
      )
      .mockResolvedValueOnce({ ...validTokens, access_token: 'forced-access' })

    renderProvider()
    await waitFor(() => expect(mockRefreshTokens).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(latestAuth).not.toBeNull())

    const forced = latestAuth!.getAccessToken({ force: true })

    await act(async () => {
      resolveFirst({ ...validTokens, access_token: 'joined-access' })
      await forced
    })

    expect(await forced).toEqual({ status: 'ok', token: 'forced-access', userId: null })
    expect(mockRefreshTokens).toHaveBeenCalledTimes(2)
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

describe('AuthProvider — granted permissions', () => {
  beforeEach(() => {
    mockLoadTokens.mockResolvedValue(noStoredTokens)
  })

  function arrangeSignIn(grantedPermissions: string[] | null, userInfo = adaUserInfo) {
    mockSignInWithPKCE.mockResolvedValue({
      kind: 'success',
      tokens: validTokens,
      userInfo,
      grantedPermissions,
    })
  }

  async function renderAndSignIn(user: ReturnType<typeof userEvent.setup>) {
    render(
      <AuthProvider {...defaultProps}>
        <AuthPeek />
      </AuthProvider>,
    )
    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    await user.press(screen.getByTestId('signIn'))
    await waitFor(() => expect(getText('signInOutcome')).toBe('resolved'))
  }

  it('sign-in with a grant makes hasPermission true and persists it per user', async () => {
    const user = userEvent.setup()
    arrangeSignIn(['highlights'])
    await renderAndSignIn(user)

    expect(getText('hasHighlights')).toBe('true')
    expect(JSON.parse(getText('grantedPermissions'))).toEqual(['highlights'])
    expect(JSON.parse(mmkvStorage.getString(MMKV_AUTH_KEYS.grantedPermissions)!)).toEqual({
      userId: 'u1',
      permissions: ['highlights'],
    })
  })

  it('seeds the grant synchronously from cache on a cold start', async () => {
    mmkvStorage.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify(adaUserInfo))
    mmkvStorage.set(
      MMKV_AUTH_KEYS.grantedPermissions,
      JSON.stringify({ userId: 'u1', permissions: ['highlights'] }),
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

    // First render, before any effect settles — the whole point of the sync seed.
    expect(getText('hasHighlights')).toBe('true')
    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(getText('hasHighlights')).toBe('true')
  })

  it('keeps a denied grant ([]) distinguishable from never-requested (null)', async () => {
    const user = userEvent.setup()
    arrangeSignIn([])
    await renderAndSignIn(user)

    expect(getText('hasHighlights')).toBe('false')
    expect(getText('grantedPermissions')).toBe('[]')
  })

  it('a scopes-only re-sign-in (null grant) preserves the same user’s earlier grant', async () => {
    // signIn on an already-signed-in user does not pass through clearAuthState,
    // so a redirect that says nothing about permissions must not wipe the grant.
    const user = userEvent.setup()
    arrangeSignIn(['highlights'])
    await renderAndSignIn(user)
    expect(getText('hasHighlights')).toBe('true')

    arrangeSignIn(null)
    await user.press(screen.getByTestId('signIn'))
    await waitFor(() => expect(getText('signInOutcome')).toBe('resolved'))

    expect(getText('hasHighlights')).toBe('true')
    expect(mmkvStorage.contains(MMKV_AUTH_KEYS.grantedPermissions)).toBe(true)
  })

  it('a scopes-only sign-in by a different user reads no grant', async () => {
    const user = userEvent.setup()
    arrangeSignIn(['highlights'])
    await renderAndSignIn(user)
    expect(getText('hasHighlights')).toBe('true')

    arrangeSignIn(null, { ...adaUserInfo, id: 'u2', name: 'Bea' })
    await user.press(screen.getByTestId('signIn'))
    await waitFor(() => expect(getText('signInOutcome')).toBe('resolved'))

    expect(getText('hasHighlights')).toBe('false')
    expect(getText('grantedPermissions')).toBe('null')
  })

  it('sign-out purges the cached grant and resets state to null', async () => {
    const user = userEvent.setup()
    arrangeSignIn(['highlights'])
    await renderAndSignIn(user)
    expect(getText('hasHighlights')).toBe('true')

    await user.press(screen.getByTestId('signOut'))

    await waitFor(() => expect(getText('isAuthenticated')).toBe('false'))
    expect(getText('hasHighlights')).toBe('false')
    expect(getText('grantedPermissions')).toBe('null')
    expect(mmkvStorage.contains(MMKV_AUTH_KEYS.grantedPermissions)).toBe(false)
  })

  it('invalidatePermissions drops both the cache and the in-memory grant', async () => {
    const user = userEvent.setup()
    arrangeSignIn(['highlights'])
    await renderAndSignIn(user)
    expect(getText('hasHighlights')).toBe('true')

    await user.press(screen.getByTestId('invalidatePermissions'))

    expect(getText('hasHighlights')).toBe('false')
    expect(getText('grantedPermissions')).toBe('null')
    expect(mmkvStorage.contains(MMKV_AUTH_KEYS.grantedPermissions)).toBe(false)
  })

  it('keeps a granted permission outside the known union verbatim', async () => {
    const user = userEvent.setup()
    arrangeSignIn(['highlights', 'brand_new_permission'])
    await renderAndSignIn(user)

    expect(JSON.parse(getText('grantedPermissions'))).toEqual([
      'highlights',
      'brand_new_permission',
    ])
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

    const { initiator, getCurrentIdentity } = mockRequestDataExchange.mock.calls[0][0]
    expect(getCurrentIdentity()).toEqual(initiator)

    fireEvent.press(screen.getByTestId('signOut'))
    await waitFor(() => expect(getText('isAuthenticated')).toBe('false'))

    // Reading a captured closure would still say 'u1' here, and the initiator
    // guard would wave a grant through for a user who has left.
    expect(getCurrentIdentity().userId).toBeNull()
    expect(getCurrentIdentity().sessionId).not.toBe(initiator.sessionId)
  })

  it('captures the initiator before awaiting the installation id, not after', async () => {
    await signInWithGrant(null)

    let releaseInstallationId = () => {}
    mockGetOrSetInstallationId.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        releaseInstallationId = () => resolve('inst-1')
      }),
    )
    mockRequestDataExchange.mockResolvedValue({ status: 'cancel' })

    const pending = requestPermissionsFromContext(['highlights'])

    // Sign out while the installation id is still resolving. The mint will
    // still use this render's token, so the initiator has to be the user that
    // token belongs to — read it afterwards and the guard compares the
    // replacement identity against itself, passes, and files the grant under
    // whoever is signed in now.
    fireEvent.press(screen.getByTestId('signOut'))
    await waitFor(() => expect(getText('isAuthenticated')).toBe('false'))

    await act(async () => {
      releaseInstallationId()
      await pending
    })

    const { initiator, accessToken } = mockRequestDataExchange.mock.calls[0][0]
    expect(accessToken).toBe('new-access')
    expect(initiator.userId).toBe('u1')
  })

  it('moves the session id on sign-out but not on a token refresh', async () => {
    await signInWithGrant(null)

    mockRequestDataExchange.mockResolvedValue({ status: 'cancel' })
    await pressRequestPermissions()
    const { getCurrentIdentity } = mockRequestDataExchange.mock.calls[0][0]
    const atSignIn = getCurrentIdentity().sessionId

    // A refresh is the same person with a new token — the guard must not fire.
    mockRefreshTokens.mockResolvedValue(validTokens)
    await act(async () => {
      fireAppStateChange('active')
    })
    expect(getCurrentIdentity().sessionId).toBe(atSignIn)

    fireEvent.press(screen.getByTestId('signOut'))
    await waitFor(() => expect(getText('isAuthenticated')).toBe('false'))
    expect(getCurrentIdentity().sessionId).not.toBe(atSignIn)
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
    mockGetOrSetInstallationId.mockImplementationOnce(() => {
      throw new Error('no installation id')
    })

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
    let settle = (_outcome: DataExchangeOutcome) => {}
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

    let settle = (_outcome: DataExchangeOutcome) => {}
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
    //
    // The reason is `in-progress`, not `transient`: `transient` invites an
    // immediate retry, which would land right back here while the consent page
    // is still open.
    const second = await act(async () => requestPermissionsFromContext(['votd']))
    expect(second).toMatchObject({ status: 'failure', reason: 'in-progress' })
    expect(mockRequestDataExchange).toHaveBeenCalledTimes(1)

    await act(async () => {
      settle({ status: 'granted', grantedPermissions: ['highlights'] })
    })
    expect(await first).toEqual({ status: 'granted', grantedPermissions: ['highlights'] })
  })

  it('shares the flow when a concurrent request asks for the same permissions in a different order', async () => {
    await signInWithGrant(null)

    let settle = (_outcome: DataExchangeOutcome) => {}
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

  /**
   * Bootstraps into a signed-in state whose access token is already at its
   * expiry, so the next `refreshToken()` actually refreshes instead of
   * short-circuiting on the leeway check.
   */
  async function signInWithStaleToken() {
    mockLoadTokens.mockResolvedValue({
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
      expiryDate: new Date(Date.now() - 1000),
    })
    mockRefreshTokens.mockResolvedValueOnce({
      ...validTokens,
      access_token: 'stale-access',
      expires_in: '0',
    })
    renderProvider()
    await waitFor(() => expect(getText('isLoading')).toBe('false'))
    expect(mockRefreshTokens).toHaveBeenCalledTimes(1)
  }

  it('refreshes an expired access token before minting, and mints with the new one', async () => {
    await signInWithStaleToken()

    mockRefreshTokens.mockResolvedValueOnce({ ...validTokens, access_token: 'fresh-access' })
    mockRequestDataExchange.mockResolvedValue({
      status: 'granted',
      grantedPermissions: ['highlights'],
    })

    await pressRequestPermissions()

    // Without this refresh the mint carries the expired token, 401s, and
    // `data-exchange-api.ts` reports every mint 401 as `not-permitted` — telling
    // the user their app key is misconfigured when the token was merely stale.
    expect(mockRefreshTokens).toHaveBeenCalledTimes(2)
    expect(mockRequestDataExchange).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'fresh-access' }),
    )
  })

  // The third state, and the one this flow used to have no name for: the token
  // is expired and the refresh did not land, but the session is intact. Minting
  // anyway earns a 401, and every mint 401 reads as `not-permitted` — dead-ending
  // a user with a stale token on "check your app key".
  it('fails transient without minting when the token is expired and the refresh fails', async () => {
    await signInWithStaleToken()

    mockRefreshTokens.mockRejectedValueOnce(new Error('Network request failed'))

    expect(await pressRequestPermissions()).toMatchObject({
      status: 'failure',
      reason: 'transient',
    })
    expect(mockRefreshTokens).toHaveBeenCalledTimes(2)
    expect(mockCreateDataExchangeApi).not.toHaveBeenCalled()
    expect(mockRequestDataExchange).not.toHaveBeenCalled()
    // Retryable, not a sign-out: the tokens stay and the user stays signed in.
    expect(getText('isAuthenticated')).toBe('true')
  })

  it('still mints with this render token when the pre-mint refresh clears the session', async () => {
    await signInWithStaleToken()

    // A revoked refresh trips `clearAuthState`, emptying the token ref — the
    // accessor's `signed-out`, which is a different case from `refresh-failed`
    // above. The flow must not change story here: it mints with the token this
    // render captured and lets the initiator guard discard the grant as
    // `user-changed`. Bailing to `not-signed-in` instead would be a different
    // contract than the one the guard and its docs describe.
    mockRefreshTokens.mockRejectedValueOnce(new TokenEndpointError(401, 'invalid_grant'))
    mockRequestDataExchange.mockResolvedValue({ status: 'cancel' })

    await pressRequestPermissions()

    expect(mockRequestDataExchange).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'stale-access' }),
    )
  })

  // Clearing a revoked session starts with a Keychain write. It can reject, and
  // this flow is documented to resolve — a consumer following that has no catch.
  it('resolves rather than rejecting when clearing a revoked session fails', async () => {
    await signInWithStaleToken()

    mockRefreshTokens.mockRejectedValueOnce(new TokenEndpointError(401, 'invalid_grant'))
    mockSaveTokens.mockRejectedValueOnce(new Error('keychain unavailable'))
    mockRequestDataExchange.mockResolvedValue({ status: 'cancel' })

    const outcome = await act(async () => requestPermissionsFromContext(['highlights']))

    // The revoked path passes no `abortOnTokenFailure`, so the rejection is
    // swallowed and the clear runs on. That empties the token ref, which puts
    // this on the same footing as the case above: mint with the render's token
    // and let the initiator guard discard the grant.
    expect(outcome).toEqual({ status: 'cancel' })
  })
})
