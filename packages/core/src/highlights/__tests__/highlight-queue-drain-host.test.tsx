/**
 * The host owns nothing but wiring: which moments wake the drain. The drain
 * itself is faked here — its behaviour is covered in `highlight-queue-drain.test`.
 */

import { render, screen } from '@testing-library/react-native'
import * as Network from 'expo-network'
import { type NetworkState } from 'expo-network'
import { act } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

import type { AuthContextValue } from '../../auth/auth-context'
import YouVersionProvider from '../../youversion-provider'
import * as api from '../api'
import { notifyDrain } from '../drain-signals'
import * as drainModule from '../drain'
import { HighlightQueueDrainHost } from '../highlight-queue-drain-host'

const drain = {
  drainNow: jest.fn(),
  noteParkedWrite: jest.fn(),
  stop: jest.fn(),
}

let networkListener: ((state: NetworkState) => void) | null = null
let appStateListener: ((state: AppStateStatus) => void) | null = null

function signedInAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    isAuthenticated: true,
    accessToken: 'token-1',
    userInfo: { id: 'user-1' },
    error: null,
    signIn: jest.fn(async () => undefined),
    signOut: jest.fn(async () => undefined),
    refreshNow: jest.fn(async () => undefined),
    getAccessToken: jest.fn(),
    isLoading: false,
    requestedPermissions: ['highlights'],
    grantedPermissions: null,
    hasPermission: jest.fn(() => false),
    invalidatePermissions: jest.fn(),
    requestPermissions: jest.fn(),
    ...overrides,
  }
}

let currentAuth: AuthContextValue | null = signedInAuth()

function emitNetwork(isConnected: boolean | undefined) {
  act(() => networkListener?.({ isConnected } as NetworkState))
}

function renderHost() {
  return render(
    <YouVersionProvider
      appKey="appkey"
      apiHost="api.youversion.com"
      hookOverrides={{ useYVAuth: currentAuth }}
    >
      <HighlightQueueDrainHost />
    </YouVersionProvider>,
  )
}

beforeEach(() => {
  networkListener = null
  appStateListener = null
  currentAuth = signedInAuth()
  drain.drainNow.mockReset()
  drain.noteParkedWrite.mockReset()
  drain.stop.mockReset()

  jest.spyOn(api, 'createHighlightsApi').mockReturnValue({} as never)
  jest.spyOn(drainModule, 'startHighlightQueueDrain').mockReturnValue(drain)
  jest.spyOn(Network, 'addNetworkStateListener').mockImplementation((listener) => {
    networkListener = listener
    return { remove: jest.fn() }
  })
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void
    return { remove: jest.fn() }
  })
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('HighlightQueueDrainHost', () => {
  it('drains on mount and renders nothing', () => {
    renderHost()

    expect(drain.drainNow).toHaveBeenCalledTimes(1)
    expect(screen.toJSON()).toBeNull()
  })

  it('reads auth through a ref that is current before the drain starts', () => {
    renderHost()

    const [{ getAuth }] = jest.mocked(drainModule.startHighlightQueueDrain).mock.calls[0]
    expect(getAuth()).toEqual({
      userId: 'user-1',
      accessToken: 'token-1',
      ensureFreshToken: expect.any(Function),
      getAccessToken: expect.any(Function),
    })
  })

  it('reports no user when auth is not configured', () => {
    currentAuth = null
    renderHost()

    const [{ getAuth }] = jest.mocked(drainModule.startHighlightQueueDrain).mock.calls[0]
    expect(getAuth()).toEqual({
      userId: null,
      accessToken: null,
      ensureFreshToken: null,
      getAccessToken: null,
    })
  })

  it('drains again when the token changes — sign-in and refresh both land here', () => {
    const { rerender } = renderHost()
    drain.drainNow.mockClear()

    currentAuth = signedInAuth({ accessToken: 'token-2' })
    rerender(
      <YouVersionProvider
        appKey="appkey"
        apiHost="api.youversion.com"
        hookOverrides={{ useYVAuth: currentAuth }}
      >
        <HighlightQueueDrainHost />
      </YouVersionProvider>,
    )

    expect(drain.drainNow).toHaveBeenCalledTimes(1)
  })

  it('drains when the app returns to active, and not on the way out', () => {
    renderHost()
    drain.drainNow.mockClear()

    act(() => appStateListener?.('background'))
    expect(drain.drainNow).not.toHaveBeenCalled()

    act(() => appStateListener?.('active'))
    expect(drain.drainNow).toHaveBeenCalledTimes(1)
  })

  it('drains on a reached service, and only starts the clock on a parked write', () => {
    renderHost()
    drain.drainNow.mockClear()

    act(() => notifyDrain('service-reached'))
    expect(drain.drainNow).toHaveBeenCalledTimes(1)
    expect(drain.noteParkedWrite).not.toHaveBeenCalled()

    act(() => notifyDrain('write-parked'))
    expect(drain.drainNow).toHaveBeenCalledTimes(1)
    expect(drain.noteParkedWrite).toHaveBeenCalledTimes(1)
  })

  it('drains on the rising edge of connectivity only', () => {
    renderHost()
    drain.drainNow.mockClear()

    // Seeded connected, so a redundant event on subscribe does not re-drain.
    emitNetwork(true)
    expect(drain.drainNow).not.toHaveBeenCalled()

    emitNetwork(false)
    emitNetwork(true)
    expect(drain.drainNow).toHaveBeenCalledTimes(1)

    emitNetwork(true)
    expect(drain.drainNow).toHaveBeenCalledTimes(1)
  })

  it('ignores an unknown connectivity state rather than treating it as a change', () => {
    renderHost()
    drain.drainNow.mockClear()

    emitNetwork(false)
    emitNetwork(undefined)
    expect(drain.drainNow).not.toHaveBeenCalled()

    emitNetwork(true)
    expect(drain.drainNow).toHaveBeenCalledTimes(1)
  })

  it('stops the drain and its listeners on unmount', () => {
    const { unmount } = renderHost()
    unmount()

    expect(drain.stop).toHaveBeenCalledTimes(1)

    act(() => notifyDrain('service-reached'))
    act(() => appStateListener?.('active'))
    emitNetwork(false)
    emitNetwork(true)
    expect(drain.drainNow).toHaveBeenCalledTimes(1)
  })
})
