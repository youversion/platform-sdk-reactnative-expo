/**
 * The host owns nothing but wiring: which moments wake the drain. The drain
 * itself is faked here — its behaviour is covered in `highlight-queue-drain.test`.
 */

import { render, screen } from '@testing-library/react-native'
import { addNetworkStateListener, type NetworkState } from 'expo-network'
import { act } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

import { useYVAuthOptional } from '../../auth'
import { useYouVersion } from '../../use-youversion'
import { notifyDrain } from '../drain-signals'
import { startHighlightQueueDrain } from '../drain'
import HighlightQueueDrainHost from '../highlight-queue-drain-host'

jest.mock('../../auth', () => ({ useYVAuthOptional: jest.fn() }))
jest.mock('../../use-youversion', () => ({ useYouVersion: jest.fn() }))
jest.mock('../api', () => ({ createHighlightsApi: jest.fn(() => ({})) }))
jest.mock('../drain', () => ({ startHighlightQueueDrain: jest.fn() }))
jest.mock('expo-network', () => ({ addNetworkStateListener: jest.fn() }))

const mockUseAuth = useYVAuthOptional as jest.Mock
const mockUseYouVersion = useYouVersion as jest.Mock
const mockStartDrain = startHighlightQueueDrain as jest.Mock
const mockAddNetworkStateListener = addNetworkStateListener as jest.Mock

const drain = {
  drainNow: jest.fn(),
  noteParkedWrite: jest.fn(),
  stop: jest.fn(),
}

let networkListener: ((state: NetworkState) => void) | null = null
let appStateListener: ((state: AppStateStatus) => void) | null = null

function emitNetwork(isConnected: boolean | undefined) {
  act(() => networkListener?.({ isConnected } as NetworkState))
}

beforeEach(() => {
  jest.clearAllMocks()
  networkListener = null
  appStateListener = null

  mockUseYouVersion.mockReturnValue({
    appKey: 'appkey',
    apiHost: 'api.youversion.com',
    installationId: 'inst-1',
  })
  mockUseAuth.mockReturnValue({
    userInfo: { id: 'user-1' },
    accessToken: 'token-1',
    ensureFreshToken: jest.fn(),
  })
  mockStartDrain.mockReturnValue(drain)
  mockAddNetworkStateListener.mockImplementation((listener) => {
    networkListener = listener
    return { remove: jest.fn() }
  })
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void
    return { remove: jest.fn() }
  })
})

describe('HighlightQueueDrainHost', () => {
  it('drains on mount and renders nothing', () => {
    render(<HighlightQueueDrainHost />)

    expect(drain.drainNow).toHaveBeenCalledTimes(1)
    expect(screen.toJSON()).toBeNull()
  })

  it('reads auth through a ref that is current before the drain starts', () => {
    render(<HighlightQueueDrainHost />)

    const [{ getAuth }] = mockStartDrain.mock.calls[0]
    expect(getAuth()).toEqual({
      userId: 'user-1',
      accessToken: 'token-1',
      ensureFreshToken: expect.any(Function),
    })
  })

  it('reports no user when auth is not configured', () => {
    mockUseAuth.mockReturnValue(null)
    render(<HighlightQueueDrainHost />)

    const [{ getAuth }] = mockStartDrain.mock.calls[0]
    expect(getAuth()).toEqual({ userId: null, accessToken: null, ensureFreshToken: null })
  })

  it('drains again when the token changes — sign-in and refresh both land here', () => {
    const { rerender } = render(<HighlightQueueDrainHost />)
    drain.drainNow.mockClear()

    mockUseAuth.mockReturnValue({
      userInfo: { id: 'user-1' },
      accessToken: 'token-2',
      ensureFreshToken: jest.fn(),
    })
    rerender(<HighlightQueueDrainHost />)

    expect(drain.drainNow).toHaveBeenCalledTimes(1)
  })

  it('drains when the app returns to active, and not on the way out', () => {
    render(<HighlightQueueDrainHost />)
    drain.drainNow.mockClear()

    act(() => appStateListener?.('background'))
    expect(drain.drainNow).not.toHaveBeenCalled()

    act(() => appStateListener?.('active'))
    expect(drain.drainNow).toHaveBeenCalledTimes(1)
  })

  it('drains on a reached service, and only starts the clock on a parked write', () => {
    render(<HighlightQueueDrainHost />)
    drain.drainNow.mockClear()

    act(() => notifyDrain('service-reached'))
    expect(drain.drainNow).toHaveBeenCalledTimes(1)
    expect(drain.noteParkedWrite).not.toHaveBeenCalled()

    act(() => notifyDrain('write-parked'))
    expect(drain.drainNow).toHaveBeenCalledTimes(1)
    expect(drain.noteParkedWrite).toHaveBeenCalledTimes(1)
  })

  it('drains on the rising edge of connectivity only', () => {
    render(<HighlightQueueDrainHost />)
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
    render(<HighlightQueueDrainHost />)
    drain.drainNow.mockClear()

    emitNetwork(false)
    emitNetwork(undefined)
    expect(drain.drainNow).not.toHaveBeenCalled()

    emitNetwork(true)
    expect(drain.drainNow).toHaveBeenCalledTimes(1)
  })

  it('stops the drain and its listeners on unmount', () => {
    const { unmount } = render(<HighlightQueueDrainHost />)
    unmount()

    expect(drain.stop).toHaveBeenCalledTimes(1)

    act(() => notifyDrain('service-reached'))
    act(() => appStateListener?.('active'))
    emitNetwork(false)
    emitNetwork(true)
    expect(drain.drainNow).toHaveBeenCalledTimes(1)
  })
})
