import type { ComponentProps, ReactNode } from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'

import { YouVersionAuthButton } from '../youversion-auth-button'
import { YouVersionProvider } from '../youversion-provider'

const mockSignIn = jest.fn()
const mockSignOut = jest.fn()
let mockIsAuthenticated = false

jest.mock('@youversion/platform-react-native-expo-core', () => ({
  YouVersionProvider: ({ children }: { children: ReactNode }) => children,
  useYVAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    signIn: mockSignIn,
    signOut: mockSignOut,
  }),
}))

// The SVG logo pulls in react-native-svg; stub it to a plain view.
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
})

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
  it('calls signIn when pressed unauthenticated (mode=auto)', async () => {
    const user = userEvent.setup()
    renderAuthButton()

    await user.press(screen.getByText(/sign in with/i))

    expect(mockSignIn).toHaveBeenCalledTimes(1)
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('calls signOut when pressed authenticated (mode=auto)', async () => {
    mockIsAuthenticated = true
    const user = userEvent.setup()
    renderAuthButton()

    await user.press(screen.getByText(/sign out of/i))

    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(mockSignIn).not.toHaveBeenCalled()
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

  it('calls signOut when mode="signOut" and unauthenticated', async () => {
    const user = userEvent.setup()
    renderAuthButton({ mode: 'signOut' })

    await user.press(screen.getByText(/sign out of/i))

    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it('calls signOut when mode="signOut" and authenticated', async () => {
    mockIsAuthenticated = true
    const user = userEvent.setup()
    renderAuthButton({ mode: 'signOut' })

    await user.press(screen.getByText(/sign out of/i))

    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(mockSignIn).not.toHaveBeenCalled()
  })
})
