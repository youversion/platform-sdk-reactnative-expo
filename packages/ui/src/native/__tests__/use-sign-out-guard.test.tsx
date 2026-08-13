import { act, renderHook } from '@testing-library/react-native'
import * as core from '@youversion/platform-react-native-expo-core'
import type { ReactNode } from 'react'
import { Alert, Platform } from 'react-native'

import en from '../../i18n/locales/en.json'
import { useSignOutGuard } from '../use-sign-out-guard'
import { YouVersionProvider } from '../youversion-provider'

const signOut = jest.fn(async () => undefined)
const USER_ID = 'user-1'

const signedInAuth = { signOut, isAuthenticated: true as const, userInfo: { id: USER_ID } }

const wrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider appKey="test-key" theme="light">
    {children}
  </YouVersionProvider>
)

type AlertButton = { text?: string; style?: string; onPress?: () => void }

function alertCall() {
  const call = (Alert.alert as jest.Mock).mock.calls.at(-1)
  expect(call).toBeTruthy()
  return {
    title: call?.[0] as string,
    message: call?.[1] as string,
    buttons: call?.[2] as AlertButton[],
  }
}

function pressAlertButton(text: string) {
  const button = alertCall().buttons.find((candidate) => candidate.text === text)
  expect(button).toBeTruthy()
  button?.onPress?.()
}

beforeEach(() => {
  signOut.mockClear()
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  jest.spyOn(core, 'hasQueuedHighlightWrites').mockReturnValue(false)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('useSignOutGuard', () => {
  it('returns undefined when auth is null', () => {
    const { result } = renderHook(() => useSignOutGuard(null), { wrapper })
    expect(result.current).toBeUndefined()
  })

  it('returns undefined when the user is signed out', async () => {
    const { result } = renderHook(
      () => useSignOutGuard({ signOut, isAuthenticated: false, userInfo: null }),
      { wrapper },
    )

    expect(result.current).toBeUndefined()

    await act(async () => {
      await result.current?.()
    })

    expect(Alert.alert).not.toHaveBeenCalled()
    expect(signOut).not.toHaveBeenCalled()
  })

  it('shows the normal sign-out alert when nothing is queued', async () => {
    const { result } = renderHook(() => useSignOutGuard(signedInAuth), { wrapper })

    await act(async () => {
      await result.current?.()
    })

    const { title, message, buttons } = alertCall()
    expect(title).toBe(en.signOutQuestion)
    expect(message).toBe(en.signOutExplanation)
    expect(buttons.map((button) => button.text)).toEqual([en.cancel, en.signOut])
    expect(signOut).not.toHaveBeenCalled()
  })

  it('signs out once the user confirms the normal variant', async () => {
    const { result } = renderHook(() => useSignOutGuard(signedInAuth), { wrapper })

    await act(async () => {
      await result.current?.()
    })
    pressAlertButton(en.signOut)

    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('keeps the user signed in when they cancel', async () => {
    const { result } = renderHook(() => useSignOutGuard(signedInAuth), { wrapper })

    await act(async () => {
      await result.current?.()
    })
    pressAlertButton(en.cancel)

    expect(signOut).not.toHaveBeenCalled()
  })

  it('escalates when queued writes exist and signs out on confirm without discarding', async () => {
    jest.spyOn(core, 'hasQueuedHighlightWrites').mockReturnValue(true)
    const { result } = renderHook(() => useSignOutGuard(signedInAuth), { wrapper })

    await act(async () => {
      await result.current?.()
    })

    const { title, message, buttons } = alertCall()
    expect(title).toBe(en.signOutPendingHighlightsQuestion)
    expect(message).toBe(en.signOutPendingHighlightsExplanation)
    expect(buttons.map((button) => button.text)).toEqual([
      en.cancel,
      en.signOutPendingHighlightsConfirm,
    ])
    expect(signOut).not.toHaveBeenCalled()

    pressAlertButton(en.signOutPendingHighlightsConfirm)

    expect(signOut).toHaveBeenCalledTimes(1)
    expect(core.hasQueuedHighlightWrites).toHaveBeenCalledWith(USER_ID)
  })

  it('logs rejecting signOut from the native confirm button without throwing', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const rejectingSignOut = jest.fn(async () => {
      throw new Error('sign-out failed')
    })
    const { result } = renderHook(
      () =>
        useSignOutGuard({
          signOut: rejectingSignOut,
          isAuthenticated: true,
          userInfo: { id: USER_ID },
        }),
      { wrapper },
    )

    await act(async () => {
      await result.current?.()
    })
    pressAlertButton(en.signOut)

    await act(async () => {
      await Promise.resolve()
    })

    expect(rejectingSignOut).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith(expect.any(Error))

    consoleError.mockRestore()
  })

  it('asks the queue about the signed-in user id', async () => {
    const hasQueued = jest.spyOn(core, 'hasQueuedHighlightWrites').mockReturnValue(false)
    const { result } = renderHook(() => useSignOutGuard(signedInAuth), { wrapper })

    await act(async () => {
      await result.current?.()
    })

    expect(hasQueued).toHaveBeenCalledWith(USER_ID)
  })

  describe('web', () => {
    const originalOs = Platform.OS

    afterEach(() => {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        enumerable: true,
        value: originalOs,
      })
    })

    it('signs out immediately without raising Alert', async () => {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        enumerable: true,
        value: 'web',
      })
      const { result } = renderHook(() => useSignOutGuard(signedInAuth), { wrapper })

      await act(async () => {
        await result.current?.()
      })

      expect(Alert.alert).not.toHaveBeenCalled()
      expect(signOut).toHaveBeenCalledTimes(1)
    })

    it('logs rejecting signOut without throwing', async () => {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        enumerable: true,
        value: 'web',
      })
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
      const rejectingSignOut = jest.fn(async () => {
        throw new Error('sign-out failed')
      })
      const { result } = renderHook(
        () =>
          useSignOutGuard({
            signOut: rejectingSignOut,
            isAuthenticated: true,
            userInfo: { id: USER_ID },
          }),
        { wrapper },
      )

      await act(async () => {
        await expect(result.current?.()).resolves.toBeUndefined()
      })

      expect(rejectingSignOut).toHaveBeenCalledTimes(1)
      expect(consoleError).toHaveBeenCalledWith(expect.any(Error))

      consoleError.mockRestore()
    })
  })
})
