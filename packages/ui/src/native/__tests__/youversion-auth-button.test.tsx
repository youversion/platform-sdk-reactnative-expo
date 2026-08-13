import type { ComponentProps } from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import * as core from '@youversion/platform-react-native-expo-core'
import { Alert, Platform } from 'react-native'

import en from '../../i18n/locales/en.json'
import { YouVersionAuthButton } from '../youversion-auth-button'
import { YouVersionProvider } from '../youversion-provider'

const mockSignIn = jest.fn(async () => undefined)
const mockSignOut = jest.fn(async () => undefined)
let mockIsAuthenticated = false

jest.mock('../bible-app-logo', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    BibleAppLogo: (props: object) => <View testID="bible-app-logo" {...props} />,
  }
})

function renderAuthButton(props: ComponentProps<typeof YouVersionAuthButton> = {}) {
  return render(
    <YouVersionProvider appKey="test-key">
      <YouVersionAuthButton {...props} />
    </YouVersionProvider>,
  )
}

beforeEach(() => {
  mockSignIn.mockClear()
  mockSignOut.mockClear()
  mockIsAuthenticated = false
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  jest.spyOn(core, 'hasQueuedHighlightWrites').mockReturnValue(false)
  jest.spyOn(core, 'useYVAuth').mockImplementation(() => ({
    isAuthenticated: mockIsAuthenticated,
    signIn: mockSignIn,
    signOut: mockSignOut,
    userInfo: mockIsAuthenticated ? { id: 'user-1' } : null,
    accessToken: mockIsAuthenticated ? 'token' : null,
    error: null,
    refreshNow: jest.fn(async () => undefined),
    ensureFreshToken: jest.fn(async () => undefined),
    getAccessToken: jest.fn(async () =>
      mockIsAuthenticated
        ? ({ status: 'ok', token: 'token', userId: 'user-1' } as const)
        : ({ status: 'unavailable', reason: 'signed-out' } as const),
    ),
    isLoading: false,
    requestedPermissions: [],
    grantedPermissions: null,
    hasPermission: () => false,
    invalidatePermissions: jest.fn(),
    requestPermissions: jest.fn(async () => ({ status: 'cancel' }) as const),
  }))
})

afterEach(() => {
  jest.restoreAllMocks()
})

type AlertButton = { text?: string; onPress?: () => void }

function pressAlertButton(text: string) {
  const call = (Alert.alert as jest.Mock).mock.calls.at(-1)
  const buttons = call?.[2] as AlertButton[] | undefined
  const button = buttons?.find((candidate) => candidate.text === text)
  expect(button).toBeTruthy()
  button?.onPress?.()
}

describe('YouVersionAuthButton labels', () => {
  it('shows "Sign in with YouVersion" when unauthenticated (mode=auto)', () => {
    renderAuthButton()
    expect(screen.getByText(/sign in with/i)).toBeTruthy()
  })

  it('shows "Sign in" when unauthenticated and size="short"', () => {
    renderAuthButton({ size: 'short' })
    expect(screen.getByText('Sign in')).toBeTruthy()
  })

  it('shows "Sign out of YouVersion" when authenticated (mode=auto)', () => {
    mockIsAuthenticated = true
    renderAuthButton()
    expect(screen.getByText(/sign out of/i)).toBeTruthy()
  })

  it('shows "Sign Out" when authenticated and size="short"', () => {
    mockIsAuthenticated = true
    renderAuthButton({ size: 'short' })
    expect(screen.getByText('Sign Out')).toBeTruthy()
  })

  it('shows "Sign out of YouVersion" when mode="signOut" even if unauthenticated', () => {
    renderAuthButton({ mode: 'signOut' })
    expect(screen.getByText(/sign out of/i)).toBeTruthy()
  })

  it('shows "Sign Out" when mode="signOut" and size="short"', () => {
    renderAuthButton({ mode: 'signOut', size: 'short' })
    expect(screen.getByText('Sign Out')).toBeTruthy()
  })

  it('shows "Sign in with YouVersion" when mode="signIn" and unauthenticated', () => {
    renderAuthButton({ mode: 'signIn' })
    expect(screen.getByText(/sign in with/i)).toBeTruthy()
  })

  it('shows "Sign in with YouVersion" when mode="signIn" even while authenticated', () => {
    mockIsAuthenticated = true
    renderAuthButton({ mode: 'signIn' })
    expect(screen.getByText(/sign in with/i)).toBeTruthy()
    expect(screen.queryByText(/sign out of/i)).toBeNull()
  })

  it('renders no label in size="icon" mode but keeps the logo', () => {
    renderAuthButton({ size: 'icon' })
    expect(screen.queryByText(/sign/i)).toBeNull()
    expect(screen.getByTestId('bible-app-logo')).toBeTruthy()
  })

  it('applies white text color on dark background for sign-in label', () => {
    renderAuthButton({ background: 'dark' })
    const label = screen.getByText(/sign in with/i)
    expect(label.props.style).toMatchObject({ color: '#fff' })
  })

  it('applies white text color on dark background for sign-out label', () => {
    mockIsAuthenticated = true
    renderAuthButton({ background: 'dark' })
    const label = screen.getByText(/sign out of/i)
    expect(label.props.style).toMatchObject({ color: '#fff' })
  })

  it('applies black text color on light background for sign-in label', () => {
    renderAuthButton({ background: 'light' })
    const label = screen.getByText(/sign in with/i)
    expect(label.props.style).toMatchObject({ color: '#000' })
  })
})

describe('YouVersionAuthButton press behavior', () => {
  const originalOs = Platform.OS

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: originalOs,
    })
  })

  it('calls signIn when pressed unauthenticated (mode=auto)', async () => {
    const user = userEvent.setup()
    renderAuthButton()

    await user.press(screen.getByText(/sign in with/i))

    expect(mockSignIn).toHaveBeenCalledTimes(1)
    expect(mockSignOut).not.toHaveBeenCalled()
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it('asks before signing out when authenticated (mode=auto)', async () => {
    mockIsAuthenticated = true
    const user = userEvent.setup()
    renderAuthButton()

    await user.press(screen.getByText(/sign out of/i))

    expect(Alert.alert).toHaveBeenCalledTimes(1)
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('signs out once the user confirms the guarded alert', async () => {
    mockIsAuthenticated = true
    const user = userEvent.setup()
    renderAuthButton()

    await user.press(screen.getByText(/sign out of/i))
    pressAlertButton(en.signOut)

    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it('escalates the alert when queued writes exist and signs out on confirm only', async () => {
    mockIsAuthenticated = true
    jest.spyOn(core, 'hasQueuedHighlightWrites').mockReturnValue(true)
    const user = userEvent.setup()
    renderAuthButton()

    await user.press(screen.getByText(/sign out of/i))

    const call = (Alert.alert as jest.Mock).mock.calls[0]
    expect(call?.[0]).toBe(en.signOutPendingHighlightsQuestion)
    expect(mockSignOut).not.toHaveBeenCalled()

    pressAlertButton(en.signOutPendingHighlightsConfirm)

    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it('calls signIn when mode="signIn" and unauthenticated', async () => {
    const user = userEvent.setup()
    renderAuthButton({ mode: 'signIn' })

    await user.press(screen.getByText(/sign in with/i))

    expect(mockSignIn).toHaveBeenCalledTimes(1)
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('calls signIn when mode="signIn" even while authenticated', async () => {
    mockIsAuthenticated = true
    const user = userEvent.setup()
    renderAuthButton({ mode: 'signIn' })

    await user.press(screen.getByText(/sign in with/i))

    expect(mockSignIn).toHaveBeenCalledTimes(1)
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('does nothing when mode="signOut" and unauthenticated', async () => {
    const user = userEvent.setup()
    renderAuthButton({ mode: 'signOut' })

    await user.press(screen.getByText(/sign out of/i))

    expect(Alert.alert).not.toHaveBeenCalled()
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('signs out immediately on web without raising Alert', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'web',
    })
    mockIsAuthenticated = true
    const user = userEvent.setup()
    renderAuthButton()

    await user.press(screen.getByText(/sign out of/i))

    expect(Alert.alert).not.toHaveBeenCalled()
    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it('calls signOut when mode="signOut" and authenticated', async () => {
    mockIsAuthenticated = true
    const user = userEvent.setup()
    renderAuthButton({ mode: 'signOut' })

    await user.press(screen.getByText(/sign out of/i))
    pressAlertButton(en.signOut)

    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(mockSignIn).not.toHaveBeenCalled()
  })
})
