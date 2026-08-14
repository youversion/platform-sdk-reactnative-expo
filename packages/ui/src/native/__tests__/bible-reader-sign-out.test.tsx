/**
 * Layer 3 — the confirmation the reader raises before it signs anyone out.
 *
 * Sign-out purges the highlights cache, the grant cache, and the Highlight Write
 * Queue, so it is never immediate. The alert escalates when the queue still holds
 * writes the server has not taken, matching the Swift SDK.
 */
import { render, screen, userEvent } from '@testing-library/react-native'
import * as core from '@youversion/platform-react-native-expo-core'
import type { ReactNode } from 'react'
import { Alert } from 'react-native'

import en from '../../i18n/locales/en.json'
import { BibleReader } from '../bible-reader'
import { YouVersionProvider } from '../youversion-provider'

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve(true)),
}))

jest.mock('expo-application', () => ({ applicationName: 'Test App' }))

const VERSION_ID = 111
const USER_ID = 'user-1'

const signOut = jest.fn(async () => undefined)

type AuthValue = NonNullable<ReturnType<typeof core.useYVAuthOptional>>

function stubAuth() {
  const value: AuthValue = {
    isAuthenticated: true,
    accessToken: 'test-token',
    userInfo: { id: USER_ID },
    error: null,
    signIn: jest.fn(async () => undefined),
    signOut,
    refreshNow: jest.fn(async () => undefined),
    getAccessToken: jest.fn(
      async () => ({ status: 'ok', token: 'test-token', userId: USER_ID }) as const,
    ),
    isLoading: false,
    requestedPermissions: ['highlights'],
    grantedPermissions: ['highlights'],
    hasPermission: () => true,
    invalidatePermissions: jest.fn(),
    requestPermissions: jest.fn(async () => ({ status: 'cancel' }) as const),
  }
  jest.spyOn(core, 'useYVAuthOptional').mockReturnValue(value)
}

jest.mock('../../dom/bible-reader', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, Pressable } = require('react-native')
  return {
    __esModule: true,
    default: function MockDOM(props: { onSignOutPress?: () => Promise<void> }) {
      return (
        <View testID="mock-dom">
          <Pressable testID="trigger-sign-out" onPress={() => void props.onSignOutPress?.()}>
            <Text>Sign out</Text>
          </Pressable>
        </View>
      )
    },
  }
})

jest.mock('../../dom/footnote-content', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: () => <View testID="mock-footnote" />,
  }
})

jest.mock('../bible-chapter-picker-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    __esModule: true,
    BibleChapterPickerSheet: () => <View testID="mock-chapter-picker-sheet" />,
  }
})

jest.mock('../bible-version-picker-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    __esModule: true,
    BibleVersionPickerSheet: () => <View testID="mock-version-picker-sheet" />,
  }
})

jest.mock('../bible-reader-settings-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    __esModule: true,
    BibleReaderSettingsSheet: () => <View testID="mock-settings-sheet" />,
  }
})

jest.mock('../native-sheet', () => {
  const actual = jest.requireActual('../native-sheet')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    ...actual,
    NativeSheet: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
      isOpen ? <View testID="sheet">{children}</View> : null,
  }
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider appKey="test-key" theme="light">
    {children}
  </YouVersionProvider>
)

const user = userEvent.setup()

type AlertButton = { text?: string; style?: string; onPress?: () => void }

function alertCall() {
  const call = (Alert.alert as jest.Mock).mock.calls[0]
  expect(call).toBeTruthy()
  return {
    title: call[0] as string,
    message: call[1] as string,
    buttons: call[2] as AlertButton[],
  }
}

function pressAlertButton(text: string) {
  const button = alertCall().buttons.find((candidate) => candidate.text === text)
  expect(button).toBeTruthy()
  button?.onPress?.()
}

async function renderAndPressSignOut(hasQueuedWrites: boolean) {
  jest.spyOn(core, 'hasQueuedHighlightWrites').mockReturnValue(hasQueuedWrites)
  stubAuth()
  render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })
  await user.press(screen.getByTestId('trigger-sign-out'))
}

beforeEach(() => {
  signOut.mockClear()
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('BibleReader — sign-out confirmation', () => {
  it('asks before signing out, and does not sign out on its own', async () => {
    await renderAndPressSignOut(false)

    const { title, message, buttons } = alertCall()
    expect(title).toBe(en.signOutQuestion)
    expect(message).toBe(en.signOutExplanation)
    expect(buttons.map((button) => button.text)).toEqual([en.cancel, en.signOut])
    expect(signOut).not.toHaveBeenCalled()
  })

  it('signs out once the user confirms', async () => {
    await renderAndPressSignOut(false)

    pressAlertButton(en.signOut)

    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('keeps the user signed in when they cancel', async () => {
    await renderAndPressSignOut(false)

    const cancel = alertCall().buttons.find((button) => button.text === en.cancel)
    expect(cancel?.style).toBe('cancel')
    cancel?.onPress?.()

    expect(signOut).not.toHaveBeenCalled()
  })

  it('escalates to the unsent-highlights variant when the queue is not empty', async () => {
    await renderAndPressSignOut(true)

    const { title, message, buttons } = alertCall()
    expect(title).toBe(en.signOutPendingHighlightsQuestion)
    expect(message).toBe(en.signOutPendingHighlightsExplanation)
    expect(buttons.map((button) => button.text)).toEqual([
      en.cancel,
      en.signOutPendingHighlightsConfirm,
    ])
    expect(signOut).not.toHaveBeenCalled()
  })

  it('signs out anyway once the user confirms the unsent-highlights variant', async () => {
    await renderAndPressSignOut(true)

    pressAlertButton(en.signOutPendingHighlightsConfirm)

    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('asks the queue about the signed-in user', async () => {
    const hasQueued = jest.spyOn(core, 'hasQueuedHighlightWrites').mockReturnValue(false)
    stubAuth()
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await user.press(screen.getByTestId('trigger-sign-out'))

    expect(hasQueued).toHaveBeenCalledWith(USER_ID)
  })

  it('leaves the DOM sign-out unwired when no auth is configured', () => {
    jest.spyOn(core, 'useYVAuthOptional').mockReturnValue(null)
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    expect(screen.getByTestId('trigger-sign-out')).toBeTruthy()
    expect(Alert.alert).not.toHaveBeenCalled()
  })
})
