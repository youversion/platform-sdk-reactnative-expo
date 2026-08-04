import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import type { ReactNode } from 'react'
import { Alert } from 'react-native'

import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import { authMock, resetAuthMock, setMockAuth, setMockSignedIn } from '../../test-utils/auth-mock'
import { resetHighlightsMock } from '../../test-utils/highlights-mock'
import { BibleReader } from '../bible-reader'
import { YouVersionAuthButton } from '../youversion-auth-button'
import { YouVersionProvider } from '../youversion-provider'

/**
 * The sign-out guard, from both surfaces the SDK owns.
 *
 * Core exposes the fact (`hasPendingHighlightOperations`); this layer owns the
 * prompt. The rule that matters is that it cannot be true on one surface and
 * missing on the other — a user who signs out from the reader's toolbar must get
 * the same warning as one who signs out from the button.
 */

jest.mock('../bible-app-logo', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return { BibleAppLogo: (props: object) => <View testID="bible-app-logo" {...props} /> }
})

jest.mock('../../dom/bible-reader', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text, View } = require('react-native')
  return {
    __esModule: true,
    default: function MockDOM(props: { onSignOutPress?: () => Promise<void> }) {
      return (
        <View testID="mock-dom">
          <Pressable testID="toolbar-sign-out" onPress={() => props.onSignOutPress?.()}>
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
  return { __esModule: true, default: () => <View testID="mock-footnote" /> }
})

jest.mock('../bible-chapter-picker-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return { __esModule: true, BibleChapterPickerSheet: () => <View testID="mock-chapter-picker" /> }
})

jest.mock('../bible-version-picker-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return { __esModule: true, BibleVersionPickerSheet: () => <View testID="mock-version-picker" /> }
})

jest.mock('../bible-reader-settings-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return { __esModule: true, BibleReaderSettingsSheet: () => <View testID="mock-settings-sheet" /> }
})

/** The reader still mounts its footnote sheet; nothing here exercises it. */
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

jest.mock('../sign-in-with-youversion-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return { __esModule: true, SignInWithYouVersionSheet: () => <View testID="mock-sign-in-sheet" /> }
})

jest.mock('../../stores/reader-settings-store', () => ({
  useReaderSettingsStore: () => ({
    fontSize: 16,
    fontFamily: '"Inter", sans-serif',
    setFontSize: jest.fn(),
    setFontFamily: jest.fn(),
  }),
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider appKey="test-key" theme="light">
    {children}
  </YouVersionProvider>
)

let alertSpy: jest.SpyInstance

beforeEach(async () => {
  resetHighlightsMock()
  resetAuthMock()
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  mmkvStorage.clearAll()
  useReaderLocationStore.setState(readerLocationStoreInitialState)
  await useReaderLocationStore.persist.rehydrate()
})

afterEach(() => {
  alertSpy.mockRestore()
})

/** The buttons the guard handed to the alert, in the order it declared them. */
function alertButtons(): { cancel: () => void; confirm: () => void } {
  const buttons = alertSpy.mock.calls.at(-1)?.[2] as
    | { text: string; style?: string; onPress?: () => void }[]
    | undefined
  if (buttons === undefined || buttons.length !== 2) {
    throw new Error('Expected the sign-out warning to offer two buttons.')
  }
  const [cancel, confirm] = buttons
  return {
    cancel: () => cancel?.onPress?.(),
    confirm: () => confirm?.onPress?.(),
  }
}

async function press(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID))
  })
}

function renderAuthButton() {
  return render(<YouVersionAuthButton size="short" />, { wrapper })
}

function renderReader() {
  return render(<BibleReader book="JHN" chapter="1" versionId={111} />, { wrapper })
}

describe('nothing pending', () => {
  it('signs out straight from the button, with no warning', async () => {
    setMockSignedIn()
    renderAuthButton()

    await act(async () => {
      fireEvent.press(screen.getByText('Sign Out'))
    })

    expect(alertSpy).not.toHaveBeenCalled()
    expect(authMock.signOut).toHaveBeenCalledTimes(1)
  })

  it('signs out straight from the reader toolbar, with no warning', async () => {
    setMockSignedIn()
    renderReader()

    await press('toolbar-sign-out')

    expect(alertSpy).not.toHaveBeenCalled()
    expect(authMock.signOut).toHaveBeenCalledTimes(1)
  })
})

describe('unsaved highlights pending', () => {
  beforeEach(() => {
    setMockSignedIn()
    setMockAuth({ hasPendingHighlightOperations: true })
  })

  it.each([
    ['the auth button', renderAuthButton, () => fireEvent.press(screen.getByText('Sign Out'))],
    [
      'the reader toolbar',
      renderReader,
      () => fireEvent.press(screen.getByTestId('toolbar-sign-out')),
    ],
  ])('warns instead of signing out from %s', async (_label, renderSurface, signOut) => {
    renderSurface()

    await act(async () => {
      signOut()
    })

    expect(alertSpy).toHaveBeenCalledTimes(1)
    expect(authMock.signOut).not.toHaveBeenCalled()
  })

  it('titles the warning with the resolved pending-highlights copy', async () => {
    renderAuthButton()

    await act(async () => {
      fireEvent.press(screen.getByText('Sign Out'))
    })

    const [title, message, buttons] = alertSpy.mock.calls[0] as [string, string, { text: string }[]]
    // Asserted on English, deliberately. i18next echoes a key it cannot find, so
    // asserting the key name passes whether or not the key exists — that
    // tautology is exactly how a rename to spellings absent from en.json shipped
    // undetected once already. English is the only assertion that can tell the
    // two apart. If the sync renames these, this test fails loudly, which is the
    // point; update it to the new copy rather than reverting to key names.
    expect(title).toBe('Save your highlights?')
    expect(message).toBe(
      "Some of your highlights haven't been saved yet, and they will be lost if you sign out. Do you want to sign out anyway?",
    )
    expect(buttons.map((button) => button.text)).toEqual(['Cancel', 'Sign out anyway'])
  })

  it('discards the queue and signs out on confirm', async () => {
    renderAuthButton()

    await act(async () => {
      fireEvent.press(screen.getByText('Sign Out'))
    })
    await act(async () => {
      alertButtons().confirm()
    })

    // Discards, never flushes. The generation bump this triggers is core's, and
    // is pinned in `packages/core/src/highlights/__tests__/queue.test.ts`.
    expect(authMock.discardPendingHighlights).toHaveBeenCalledTimes(1)
    expect(authMock.signOut).toHaveBeenCalledTimes(1)
  })

  it('discards from the reader toolbar too', async () => {
    renderReader()

    await press('toolbar-sign-out')
    await act(async () => {
      alertButtons().confirm()
    })

    expect(authMock.discardPendingHighlights).toHaveBeenCalledTimes(1)
    expect(authMock.signOut).toHaveBeenCalledTimes(1)
  })

  it('leaves the user signed in and the queue intact on cancel', async () => {
    renderAuthButton()

    await act(async () => {
      fireEvent.press(screen.getByText('Sign Out'))
    })
    await act(async () => {
      alertButtons().cancel()
    })

    expect(authMock.discardPendingHighlights).not.toHaveBeenCalled()
    expect(authMock.signOut).not.toHaveBeenCalled()
  })

  it('treats an Android back-button dismiss as a cancel', async () => {
    renderAuthButton()

    await act(async () => {
      fireEvent.press(screen.getByText('Sign Out'))
    })

    const options = alertSpy.mock.calls[0]?.[3] as { onDismiss?: () => void } | undefined
    await act(async () => {
      options?.onDismiss?.()
    })

    expect(authMock.discardPendingHighlights).not.toHaveBeenCalled()
    expect(authMock.signOut).not.toHaveBeenCalled()
  })

  it('still warns before an explicit mode="signOut" press', async () => {
    render(<YouVersionAuthButton mode="signOut" size="short" />, { wrapper })

    await act(async () => {
      fireEvent.press(screen.getByText('Sign Out'))
    })

    expect(alertSpy).toHaveBeenCalledTimes(1)
    expect(authMock.signOut).not.toHaveBeenCalled()
  })

  it('never warns on the way IN — signing in has nothing to lose', async () => {
    setMockAuth({ isAuthenticated: false, accessToken: null })
    render(<YouVersionAuthButton mode="signIn" size="short" />, { wrapper })

    await act(async () => {
      fireEvent.press(screen.getByText('Sign in'))
    })

    expect(alertSpy).not.toHaveBeenCalled()
    expect(authMock.signIn).toHaveBeenCalledTimes(1)
  })
})

describe('no auth configured', () => {
  it('leaves the reader toolbar without a sign-out handler at all', async () => {
    renderReader()

    // `useYVAuthOptional()` returns null, so there is nothing to guard and
    // nothing to call — the toolbar press is inert rather than throwing.
    await press('toolbar-sign-out')

    expect(alertSpy).not.toHaveBeenCalled()
    expect(authMock.signOut).not.toHaveBeenCalled()
  })
})
