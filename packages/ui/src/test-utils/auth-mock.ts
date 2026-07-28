import type { YVUserInfo } from '@youversion/platform-react-native-expo-core'

/**
 * The controllable stand-in for core's auth hooks, installed once in
 * `jest.setup.js` alongside the wholesale mock of the core package.
 *
 * The real `AuthProvider` reads secure storage, refreshes tokens, and subscribes
 * to `AppState` — none of which layer-3 native tests stand up. `AuthContext`
 * itself is not exported from the package, so a test cannot supply one directly;
 * steer this instead of re-mocking the core module per file.
 */

type MockAuthState = {
  /** `auth` was configured on `YouVersionProvider`. Drives `useYVAuthOptional`. */
  isAuthConfigured: boolean
  isAuthenticated: boolean
  accessToken: string | null
  userInfo: YVUserInfo | null
  isLoading: boolean
}

const SIGNED_OUT: MockAuthState = {
  isAuthConfigured: false,
  isAuthenticated: false,
  accessToken: null,
  userInfo: null,
  isLoading: false,
}

const state: MockAuthState = { ...SIGNED_OUT }

export const authMock = {
  signIn: jest.fn<Promise<void>, []>(async () => {}),
  signOut: jest.fn<Promise<void>, []>(async () => {}),
  refreshNow: jest.fn<Promise<void>, []>(async () => {}),
}

/**
 * Sign the mock user in. Defaults to the shape a real sign-in produces: a token,
 * a user id, and `auth` configured on the provider.
 */
export function setMockAuth(next: Partial<MockAuthState>): void {
  Object.assign(state, next)
}

export function setMockSignedIn(userId = 'test-user-id'): void {
  Object.assign(state, {
    isAuthConfigured: true,
    isAuthenticated: true,
    accessToken: 'test-access-token',
    userInfo: { id: userId },
    isLoading: false,
  } satisfies MockAuthState)
}

/** Restore the auth-not-configured default. Call from `beforeEach`. */
export function resetAuthMock(): void {
  Object.assign(state, SIGNED_OUT)
  authMock.signIn.mockClear()
  authMock.signOut.mockClear()
  authMock.refreshNow.mockClear()
}

function currentValue() {
  return {
    isAuthenticated: state.isAuthenticated,
    accessToken: state.accessToken,
    userInfo: state.userInfo,
    error: null,
    signIn: authMock.signIn,
    signOut: authMock.signOut,
    refreshNow: authMock.refreshNow,
    isLoading: state.isLoading,
  }
}

/**
 * `useYVAuth` throws in production when `auth` is unconfigured, but every UI test
 * predating this mock called it without one and expected a signed-out object.
 * Keep that: the configured/unconfigured distinction is what `useYVAuthOptional`
 * is for, and it is the hook the reader actually uses.
 */
export function createUseYVAuthMock(): () => ReturnType<typeof currentValue> {
  return () => currentValue()
}

export function createUseYVAuthOptionalMock(): () => ReturnType<typeof currentValue> | null {
  return () => (state.isAuthConfigured ? currentValue() : null)
}
