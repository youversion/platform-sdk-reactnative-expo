import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { RequestPermissionResult } from '@youversion/platform-react-native-expo-core'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import type { BibleReaderHighlightIntent } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'
import { Alert } from 'react-native'

import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import { authMock, resetAuthMock, setMockAuth, setMockSignedIn } from '../../test-utils/auth-mock'
import { highlightsMock, resetHighlightsMock } from '../../test-utils/highlights-mock'
import { BibleReader } from '../bible-reader'
import { YouVersionProvider } from '../youversion-provider'

/**
 * The Swift edge-case inventory, as assertions. Every path through the tap fork
 * ends in exactly one of two places: the Pending Highlight is written, or it is
 * discarded. Nothing is allowed to linger.
 */

const VERSION_ID = 111

const JHN_1_INTENT: BibleReaderHighlightIntent = {
  versionId: VERSION_ID,
  book: 'JHN',
  chapter: '1',
  verses: [1, 2],
  passageIds: ['JHN.1.1', 'JHN.1.2'],
  color: 'fffe00',
}

let mockNextIntent: BibleReaderHighlightIntent = JHN_1_INTENT

jest.mock('../../dom/bible-reader', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, Pressable } = require('react-native')
  return {
    __esModule: true,
    default: function MockDOM(props: {
      onChapterChange?: (chapter: string) => Promise<void>
      onHighlightApply?: (intent: BibleReaderHighlightIntent) => Promise<void>
      onHighlightRemove?: (intent: BibleReaderHighlightIntent) => Promise<void>
    }) {
      return (
        <View testID="mock-dom">
          <Pressable testID="trigger-chapter-change" onPress={() => props.onChapterChange?.('3')}>
            <Text>Chapter</Text>
          </Pressable>
          <Pressable
            testID="trigger-highlight-apply"
            onPress={() => props.onHighlightApply?.(mockNextIntent)}
          >
            <Text>Apply</Text>
          </Pressable>
          <Pressable
            testID="trigger-highlight-remove"
            onPress={() => props.onHighlightRemove?.(mockNextIntent)}
          >
            <Text>Remove</Text>
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

/**
 * Only one sheet is ever open in these tests, so a single `sheet-dismiss` handle
 * stands in for the swipe-down / backdrop / X exits — all of which reach the
 * sheet through the same `onClose`.
 */
jest.mock('../native-sheet', () => {
  const actual = jest.requireActual('../native-sheet')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, View } = require('react-native')
  return {
    ...actual,
    NativeSheet: ({
      isOpen,
      onClose,
      children,
    }: {
      isOpen: boolean
      onClose: () => void
      children: ReactNode
    }) =>
      isOpen ? (
        <View testID="sheet">
          <Pressable testID="sheet-dismiss" onPress={onClose} />
          {children}
        </View>
      ) : null,
  }
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
  mockNextIntent = JHN_1_INTENT
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

function renderReader() {
  return render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })
}

async function tapSwatch() {
  await act(async () => {
    fireEvent.press(screen.getByTestId('trigger-highlight-apply'))
  })
}

async function press(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID))
  })
}

/** The button callbacks the reader handed to the just-in-time `Alert`. */
function alertButtons(): { cancel: () => void; confirm: () => void } {
  const buttons = alertSpy.mock.calls.at(-1)?.[2] as
    | { text: string; style?: string; onPress?: () => void }[]
    | undefined
  if (buttons === undefined || buttons.length !== 2) {
    throw new Error('Expected the just-in-time alert to offer two buttons.')
  }
  const [cancel, confirm] = buttons
  return {
    cancel: () => cancel?.onPress?.(),
    confirm: () => confirm?.onPress?.(),
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('auth not configured', () => {
  it('is a silent no-op: nothing painted, no sheet, no alert', async () => {
    renderReader()

    await tapSwatch()

    expect(highlightsMock.apply).not.toHaveBeenCalled()
    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
    expect(alertSpy).not.toHaveBeenCalled()
    expect(authMock.signIn).not.toHaveBeenCalled()
  })
})

describe('signed out — the one-step path', () => {
  beforeEach(() => {
    setMockAuth({ isAuthConfigured: true })
  })

  it('opens the sign-in sheet and holds the highlight instead of writing it', async () => {
    renderReader()

    await tapSwatch()

    expect(screen.getByTestId('sign-in-with-youversion-sheet')).toBeTruthy()
    expect(highlightsMock.apply).not.toHaveBeenCalled()
  })

  it('applies the held highlight once sign-in grants highlights — no re-selecting the verse', async () => {
    authMock.signIn.mockImplementation(async () => {
      setMockSignedIn()
    })
    renderReader()

    await tapSwatch()
    await press('sign-in-with-youversion-confirm')

    expect(authMock.signIn).toHaveBeenCalledTimes(1)
    expect(highlightsMock.apply).toHaveBeenCalledWith('fffe00', [1, 2])
    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
  })

  it('replays a remove intent, not just an apply', async () => {
    mockNextIntent = { ...JHN_1_INTENT, color: '00d6ff', verses: [2], passageIds: ['JHN.1.2'] }
    authMock.signIn.mockImplementation(async () => {
      setMockSignedIn()
    })
    renderReader()

    await act(async () => {
      fireEvent.press(screen.getByTestId('trigger-highlight-remove'))
    })
    await press('sign-in-with-youversion-confirm')

    expect(highlightsMock.remove).toHaveBeenCalledWith('00d6ff', [2])
    expect(highlightsMock.apply).not.toHaveBeenCalled()
  })

  it('clears the held highlight when sign-in completes without the highlights permission', async () => {
    authMock.signIn.mockImplementation(async () => {
      setMockAuth({
        isAuthConfigured: true,
        isAuthenticated: true,
        accessToken: 'test-access-token',
        userInfo: { id: 'test-user-id' },
        grantedPermissions: [],
      })
    })
    renderReader()

    await tapSwatch()
    await press('sign-in-with-youversion-confirm')

    expect(highlightsMock.apply).not.toHaveBeenCalled()
    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
    // And nothing is left pending: it does not paint later either.
    expect(alertSpy).not.toHaveBeenCalled()
  })

  it('clears the held highlight when the user cancels the browser session', async () => {
    // A cancelled `signInWithPKCE` resolves without changing auth state.
    renderReader()

    await tapSwatch()
    await press('sign-in-with-youversion-confirm')

    expect(highlightsMock.apply).not.toHaveBeenCalled()
    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
  })

  it('clears the held highlight when sign-in throws', async () => {
    authMock.signIn.mockImplementation(async () => {
      throw new Error('token endpoint exploded')
    })
    renderReader()

    await tapSwatch()
    await press('sign-in-with-youversion-confirm')

    expect(highlightsMock.apply).not.toHaveBeenCalled()
  })

  it('“No Thanks” closes the sheet and leaves nothing pending', async () => {
    renderReader()

    await tapSwatch()
    await press('sign-in-with-youversion-decline')

    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()

    // Signing in afterwards must not resurrect the discarded highlight.
    await act(async () => {
      setMockSignedIn()
    })
    expect(highlightsMock.apply).not.toHaveBeenCalled()
  })

  it('a swipe-down or backdrop tap is a cancel too', async () => {
    renderReader()

    await tapSwatch()
    await press('sheet-dismiss')

    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
    expect(highlightsMock.apply).not.toHaveBeenCalled()
  })

  it('drops a held highlight whose chapter the reader has left', async () => {
    const session = deferred<void>()
    authMock.signIn.mockImplementation(async () => {
      await session.promise
      setMockSignedIn()
    })
    // Uncontrolled so the DOM-driven chapter change actually lands.
    render(<BibleReader versionId={VERSION_ID} />, { wrapper })

    await tapSwatch()
    await press('sign-in-with-youversion-confirm')

    // The user navigated away while the browser session was up.
    await act(async () => {
      fireEvent.press(screen.getByTestId('trigger-chapter-change'))
    })
    await act(async () => {
      session.resolve()
      await session.promise
    })

    expect(highlightsMock.apply).not.toHaveBeenCalled()
  })
})

describe('signed in without the permission — the two-step path', () => {
  beforeEach(() => {
    setMockSignedIn()
    setMockAuth({ grantedPermissions: [] })
  })

  it('shows the just-in-time alert instead of writing, and opens no sheet', async () => {
    renderReader()

    await tapSwatch()

    expect(highlightsMock.apply).not.toHaveBeenCalled()
    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
    expect(alertSpy).toHaveBeenCalledTimes(1)
  })

  it('titles the alert with the canonical data-exchange keys', async () => {
    renderReader()

    await tapSwatch()

    const [title, message, buttons] = alertSpy.mock.calls[0] as [string, string, { text: string }[]]
    // Asserted on keys, not English: the copy lands via the localization sync.
    expect(title).toBe('dataExchange.highlights.question')
    expect(message).toBe('dataExchange.highlights.explanation')
    expect(buttons.map((button) => button.text)).toEqual([
      'generic.cancel',
      'dataExchange.continue',
    ])
  })

  it('“Continue” runs the data exchange for highlights', async () => {
    renderReader()

    await tapSwatch()
    await act(async () => {
      alertButtons().confirm()
    })

    expect(authMock.requestPermission).toHaveBeenCalledWith('highlights')
  })

  it('applies the held highlight and force-reloads the chapter when the grant lands', async () => {
    authMock.requestPermission.mockResolvedValue({
      kind: 'granted',
      permissions: ['highlights'],
    } satisfies RequestPermissionResult)
    renderReader()

    await tapSwatch()
    await act(async () => {
      alertButtons().confirm()
    })

    expect(highlightsMock.apply).toHaveBeenCalledWith('fffe00', [1, 2])
    // Swift's `forceReload: true` — highlights created on the web appear too.
    expect(highlightsMock.refresh).toHaveBeenCalledTimes(1)
  })

  it('clears the held highlight when the exchange grants something else', async () => {
    authMock.requestPermission.mockResolvedValue({
      kind: 'granted',
      permissions: ['votd'],
    } satisfies RequestPermissionResult)
    renderReader()

    await tapSwatch()
    await act(async () => {
      alertButtons().confirm()
    })

    expect(highlightsMock.apply).not.toHaveBeenCalled()
    expect(highlightsMock.refresh).not.toHaveBeenCalled()
  })

  it('clears the held highlight when the user denies on the consent page', async () => {
    authMock.requestPermission.mockResolvedValue({
      kind: 'cancel',
    } satisfies RequestPermissionResult)
    renderReader()

    await tapSwatch()
    await act(async () => {
      alertButtons().confirm()
    })

    expect(highlightsMock.apply).not.toHaveBeenCalled()
  })

  it('clears the held highlight when the exchange fails', async () => {
    authMock.requestPermission.mockResolvedValue({
      kind: 'failure',
      message: 'The signed-in user changed during the data exchange.',
    } satisfies RequestPermissionResult)
    renderReader()

    await tapSwatch()
    await act(async () => {
      alertButtons().confirm()
    })

    expect(highlightsMock.apply).not.toHaveBeenCalled()
  })

  it('“Cancel” on the alert leaves nothing pending', async () => {
    renderReader()

    await tapSwatch()
    await act(async () => {
      alertButtons().cancel()
    })

    expect(authMock.requestPermission).not.toHaveBeenCalled()
    expect(highlightsMock.apply).not.toHaveBeenCalled()

    // A later grant must not resurrect the discarded highlight.
    await act(async () => {
      setMockSignedIn()
    })
    expect(highlightsMock.apply).not.toHaveBeenCalled()
  })

  it('re-prompts on the next tap rather than staying stuck', async () => {
    renderReader()

    await tapSwatch()
    await act(async () => {
      alertButtons().cancel()
    })
    await tapSwatch()

    expect(alertSpy).toHaveBeenCalledTimes(2)
  })

  it('drops a held highlight whose chapter the reader has left', async () => {
    const session = deferred<RequestPermissionResult>()
    authMock.requestPermission.mockReturnValue(session.promise)
    render(<BibleReader versionId={VERSION_ID} />, { wrapper })

    await tapSwatch()
    await act(async () => {
      alertButtons().confirm()
    })
    await act(async () => {
      fireEvent.press(screen.getByTestId('trigger-chapter-change'))
    })
    await act(async () => {
      session.resolve({ kind: 'granted', permissions: ['highlights'] })
      await session.promise
    })

    expect(highlightsMock.apply).not.toHaveBeenCalled()
    // The force-reload still fires: the grant is real even if the tap is stale.
    expect(highlightsMock.refresh).toHaveBeenCalledTimes(1)
  })
})

describe('signed in with the permission', () => {
  it('writes straight through — no sheet, no alert', async () => {
    setMockSignedIn()
    renderReader()

    await tapSwatch()

    expect(highlightsMock.apply).toHaveBeenCalledWith('fffe00', [1, 2])
    expect(alertSpy).not.toHaveBeenCalled()
    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
  })
})
