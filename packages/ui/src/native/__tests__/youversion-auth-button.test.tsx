import type { ComponentProps } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import { render, screen, userEvent } from '@testing-library/react-native'
import { Alert, Platform, StyleSheet, Text, View } from 'react-native'

import { useTokens } from '../../hooks'
import en from '../../i18n/locales/en.json'
import { defaultHookOverrides, signedOutAuth } from '../../test-utils/default-hook-overrides'
import { resetImpls, setImpl } from '../../test-utils/install-test-impls'
import { seedQueuedHighlightWrites } from '../../test-utils/seed-queued-highlight-writes'
import { getTokens } from '../../theme'
import { fontMapKey } from '../../theme/fonts'
import { YouVersionAuthButton, type YouVersionAuthButtonProps } from '../youversion-auth-button'
import { YouVersionProvider } from '../youversion-provider'

type RemovedAuthButtonProp = 'outline' | 'radius' | 'size'
type RemovedStillPresent = Extract<RemovedAuthButtonProp, keyof YouVersionAuthButtonProps>
type AssertNever<T extends never> = T
type _removedAuthButtonProps = AssertNever<RemovedStillPresent>

function ThemeProbe() {
  const tokens = useTokens()
  return <Text testID="theme-probe">{tokens.primary}</Text>
}

const light = getTokens('light')
const dark = getTokens('dark')

const mockSignIn = jest.fn(async () => undefined)
const mockSignOut = jest.fn(async () => undefined)
let mockIsAuthenticated = false

function authValue() {
  return signedOutAuth({
    isAuthenticated: mockIsAuthenticated,
    signIn: mockSignIn,
    signOut: mockSignOut,
    userInfo: mockIsAuthenticated ? { id: 'user-1' } : null,
    accessToken: mockIsAuthenticated ? 'token' : null,
    getAccessToken: async () =>
      mockIsAuthenticated
        ? ({ status: 'ok', token: 'token', userId: 'user-1' } as const)
        : ({ status: 'unavailable', reason: 'signed-out' } as const),
  })
}

function renderAuthButton(
  props: ComponentProps<typeof YouVersionAuthButton> = {},
  providerTheme: 'light' | 'dark' = 'light',
) {
  return render(
    <YouVersionProvider
      appKey="test-key"
      theme={providerTheme}
      hookOverrides={{ ...defaultHookOverrides, useYVAuth: authValue() }}
    >
      <YouVersionAuthButton {...props} />
    </YouVersionProvider>,
  )
}

beforeEach(() => {
  mockSignIn.mockClear()
  mockSignOut.mockClear()
  mockIsAuthenticated = false
  mmkvStorage.clearAll()
  setImpl('BibleAppLogo', (props) => <View testID="bible-app-logo" {...props} />)
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
})

afterEach(() => {
  resetImpls()
  jest.restoreAllMocks()
})

function pressAlertButton(text: string) {
  const call = jest.mocked(Alert.alert).mock.calls.at(-1)
  const buttons = call?.[2] ?? []
  const button = buttons.find((candidate) => candidate.text === text)
  expect(button).toBeTruthy()
  button?.onPress?.()
}

function buttonStyle() {
  return StyleSheet.flatten(screen.getByRole('button').props.style)
}

function labelStyle(matcher: string | RegExp) {
  return StyleSheet.flatten(screen.getByText(matcher).props.style)
}

describe('YouVersionAuthButton labels', () => {
  it('shows "Sign in with YouVersion" when unauthenticated (mode=auto)', () => {
    renderAuthButton()
    expect(screen.getByRole('button', { name: 'Sign in with YouVersion' })).toBeTruthy()
    expect(screen.getByTestId('bible-app-logo')).toBeTruthy()
  })

  it('shows "Sign out of YouVersion" when authenticated (mode=auto)', () => {
    mockIsAuthenticated = true
    renderAuthButton()
    expect(screen.getByRole('button', { name: 'Sign out of YouVersion' })).toBeTruthy()
  })

  it('shows "Sign out of YouVersion" when mode="signOut" even if unauthenticated', () => {
    renderAuthButton({ mode: 'signOut' })
    expect(screen.getByRole('button', { name: 'Sign out of YouVersion' })).toBeTruthy()
  })

  it('shows "Sign in with YouVersion" when mode="signIn" and unauthenticated', () => {
    renderAuthButton({ mode: 'signIn' })
    expect(screen.getByRole('button', { name: 'Sign in with YouVersion' })).toBeTruthy()
  })

  it('shows "Sign in with YouVersion" when mode="signIn" even while authenticated', () => {
    mockIsAuthenticated = true
    renderAuthButton({ mode: 'signIn' })
    expect(screen.getByRole('button', { name: 'Sign in with YouVersion' })).toBeTruthy()
    expect(screen.queryByText('Sign out of YouVersion')).toBeNull()
  })

  it('replaces the localized label when text is passed', () => {
    renderAuthButton({ text: 'Continue with YouVersion' })
    expect(screen.getByRole('button', { name: 'Continue with YouVersion' })).toBeTruthy()
    expect(screen.queryByText('Sign in with YouVersion')).toBeNull()
  })

  it('paints the light scheme label in foreground', () => {
    renderAuthButton({ background: 'light' })
    expect(labelStyle('Sign in with YouVersion')).toMatchObject({ color: light.foreground })
  })

  it('paints the dark scheme label in foreground', () => {
    mockIsAuthenticated = true
    renderAuthButton({ background: 'dark' })
    expect(labelStyle('Sign out of YouVersion')).toMatchObject({ color: dark.foreground })
  })

  it('paints the brand name in the bold sans face', () => {
    renderAuthButton()
    expect(labelStyle('YouVersion')).toMatchObject({
      fontFamily: fontMapKey(light.fontFamily.sans, 700, 'normal'),
    })
  })
})

describe('YouVersionAuthButton container tokens', () => {
  it('fills the default Button from the light scheme even when the provider is dark', () => {
    renderAuthButton({ background: 'light' }, 'dark')

    expect(buttonStyle()).toMatchObject({
      backgroundColor: light.background,
      borderRadius: light.radius.full,
    })
    expect(buttonStyle().borderWidth).toBeUndefined()
  })

  it('fills the default Button from the dark scheme even when the provider is light', () => {
    renderAuthButton({ background: 'dark' }, 'light')

    expect(buttonStyle()).toMatchObject({
      backgroundColor: dark.background,
      borderRadius: dark.radius.full,
    })
    expect(buttonStyle().borderWidth).toBeUndefined()
  })

  it('does not leak the forced scheme to siblings', () => {
    render(
      <YouVersionProvider
        appKey="test-key"
        theme="light"
        hookOverrides={{ ...defaultHookOverrides, useYVAuth: authValue() }}
      >
        <YouVersionAuthButton background="dark" />
        <ThemeProbe />
      </YouVersionProvider>,
    )

    expect(buttonStyle()).toMatchObject({ backgroundColor: dark.background })
    expect(screen.getByTestId('theme-probe').props.children).toBe(light.primary)
  })
})

describe('youversion-auth-button source', () => {
  it('keeps youversion-auth-button.tsx free of copied hex literals', () => {
    const source = readFileSync(join(__dirname, '..', 'youversion-auth-button.tsx'), 'utf8')

    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
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

    await user.press(screen.getByRole('button', { name: 'Sign in with YouVersion' }))

    expect(mockSignIn).toHaveBeenCalledTimes(1)
    expect(mockSignOut).not.toHaveBeenCalled()
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it('logs when signIn rejects', async () => {
    const boom = new Error('sign-in failed')
    mockSignIn.mockRejectedValueOnce(boom)
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup()
    renderAuthButton()

    await user.press(screen.getByRole('button', { name: 'Sign in with YouVersion' }))

    expect(errorSpy).toHaveBeenCalledWith(boom)
  })

  it('asks before signing out when authenticated (mode=auto)', async () => {
    mockIsAuthenticated = true
    const user = userEvent.setup()
    renderAuthButton()

    await user.press(screen.getByRole('button', { name: 'Sign out of YouVersion' }))

    expect(Alert.alert).toHaveBeenCalledTimes(1)
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('signs out once the user confirms the guarded alert', async () => {
    mockIsAuthenticated = true
    const user = userEvent.setup()
    renderAuthButton()

    await user.press(screen.getByRole('button', { name: 'Sign out of YouVersion' }))
    pressAlertButton(en.signOut)

    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it('escalates the alert when queued writes exist and signs out on confirm only', async () => {
    mockIsAuthenticated = true
    seedQueuedHighlightWrites('user-1')
    const user = userEvent.setup()
    renderAuthButton()

    await user.press(screen.getByRole('button', { name: 'Sign out of YouVersion' }))

    const call = jest.mocked(Alert.alert).mock.calls[0]
    expect(call?.[0]).toBe(en.signOutPendingHighlightsQuestion)
    expect(mockSignOut).not.toHaveBeenCalled()

    pressAlertButton(en.signOutPendingHighlightsConfirm)

    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it('calls signIn when mode="signIn" and unauthenticated', async () => {
    const user = userEvent.setup()
    renderAuthButton({ mode: 'signIn' })

    await user.press(screen.getByRole('button', { name: 'Sign in with YouVersion' }))

    expect(mockSignIn).toHaveBeenCalledTimes(1)
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('calls signIn when mode="signIn" even while authenticated', async () => {
    mockIsAuthenticated = true
    const user = userEvent.setup()
    renderAuthButton({ mode: 'signIn' })

    await user.press(screen.getByRole('button', { name: 'Sign in with YouVersion' }))

    expect(mockSignIn).toHaveBeenCalledTimes(1)
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('calls signOut without Alert when mode="signOut" and unauthenticated', async () => {
    const user = userEvent.setup()
    renderAuthButton({ mode: 'signOut' })

    await user.press(screen.getByRole('button', { name: 'Sign out of YouVersion' }))

    expect(Alert.alert).not.toHaveBeenCalled()
    expect(mockSignOut).toHaveBeenCalledTimes(1)
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

    await user.press(screen.getByRole('button', { name: 'Sign out of YouVersion' }))

    expect(Alert.alert).not.toHaveBeenCalled()
    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it('calls signOut when mode="signOut" and authenticated', async () => {
    mockIsAuthenticated = true
    const user = userEvent.setup()
    renderAuthButton({ mode: 'signOut' })

    await user.press(screen.getByRole('button', { name: 'Sign out of YouVersion' }))
    pressAlertButton(en.signOut)

    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(mockSignIn).not.toHaveBeenCalled()
  })
})
