/**
 * Layer 3 — the two prompts that stand between a swatch press and a write.
 *
 * The reader owns the sign-in pre-step (the Permission Flow has no sign-in
 * prompt state of its own, so `flow.apply` would launch OAuth unannounced), and
 * the flow owns the consent step via `isConfirming`. The invariant across both:
 * exactly one sheet is active, so a prompt never displaces the action sheet and
 * fires `closeVerseActions` as a side effect.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { Highlight } from '@youversion/platform-react-native-expo-core'
import * as core from '@youversion/platform-react-native-expo-core'
import type { BibleReaderShareData, BibleReaderVerseSelection } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'

import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import { BibleReader } from '../bible-reader'
import { YouVersionProvider } from '../youversion-provider'

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve(true)),
}))

// The sign-in sheet interpolates the host app's display name into its
// paragraph. The real module reads a native constant that jest-expo does not
// supply, and the copy is not what these tests are about.
jest.mock('expo-application', () => ({ applicationName: 'Test App' }))

const VERSION_ID = 111

const SHARE_DATA: BibleReaderShareData = {
  text: '“In the beginning was the Word...”\n\nJohn 1:1-2 BSB',
  reference: 'John 1:1-2 BSB',
  verseText: '“In the beginning was the Word...”',
  verses: [1, 2],
  book: 'JHN',
  chapter: '1',
  versionId: VERSION_ID,
}

const SELECTION: BibleReaderVerseSelection = {
  versionId: VERSION_ID,
  book: 'JHN',
  chapter: '1',
  verses: [1, 2],
  passageIds: ['JHN.1.1', 'JHN.1.2'],
  reference: 'John 1:1-2',
  shareData: SHARE_DATA,
}

const GREEN = '5dff79'
const BLUE = '00d6ff'

function highlight(verse: number, color: string): Highlight {
  return { version_id: VERSION_ID, passage_id: `JHN.1.${verse}`, color }
}

const flowApply = jest.fn(async () => ({ status: 'noop' }) as const)
const flowConfirm = jest.fn()
const flowDecline = jest.fn()
const rawApply = jest.fn(async () => ({ status: 'noop' }) as const)
const rawRemove = jest.fn(async () => ({ status: 'noop' }) as const)

/**
 * `jest.setup.js` stubs this hook globally (the real one needs core's own
 * provider, which UI tests replace). Steer it per test rather than re-mocking
 * the whole package and losing that passthrough provider.
 */
function stubFlow({ highlights = [] as Highlight[], isConfirming = false } = {}) {
  jest
    .spyOn(core, 'useHighlightPermissionFlow')
    .mockImplementation(({ versionId, book, chapter }) => ({
      highlights: {
        highlights,
        scope: { versionId, book, chapter },
        isRefreshing: false,
        error: null,
        refresh: jest.fn(async () => undefined),
        apply: rawApply,
        remove: rawRemove,
      },
      isConfirming,
      apply: flowApply,
      confirm: flowConfirm,
      decline: flowDecline,
      flowError: null,
    }))
}

type AuthValue = NonNullable<ReturnType<typeof core.useYVAuthOptional>>

/**
 * A consumer *with* `auth` configured. `null` — the default in UI tests, since
 * the passthrough provider mounts no `AuthProvider` — means something different
 * and is covered by its own case below.
 */
function stubAuth(isAuthenticated: boolean) {
  const value: AuthValue = {
    isAuthenticated,
    accessToken: isAuthenticated ? 'test-token' : null,
    userInfo: null,
    error: null,
    signIn: jest.fn(async () => undefined),
    signOut: jest.fn(async () => undefined),
    refreshNow: jest.fn(async () => undefined),
    ensureFreshToken: jest.fn(async () => undefined),
    isLoading: false,
    requestedPermissions: ['highlights'],
    grantedPermissions: null,
    hasPermission: () => false,
    invalidatePermissions: jest.fn(),
    requestPermissions: jest.fn(async () => ({ status: 'cancel' }) as const),
  }
  jest.spyOn(core, 'useYVAuthOptional').mockReturnValue(value)
}

let mockNextSelection: BibleReaderVerseSelection = SELECTION

jest.mock('../../dom/bible-reader', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, Pressable } = require('react-native')
  return {
    __esModule: true,
    default: function MockDOM(props: {
      onVerseSelect?: (selection: BibleReaderVerseSelection) => Promise<void>
    }) {
      return (
        <View testID="mock-dom">
          <Pressable
            testID="trigger-verse-select"
            onPress={() => void props.onVerseSelect?.(mockNextSelection)}
          >
            <Text>Select</Text>
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

/**
 * Same stand-in as the verse-action suite. `sheet-dismiss` is every
 * non-button exit — swipe-down, backdrop tap, and displacement by another sheet
 * all land on `NativeSheet`'s single `onClose`.
 *
 * Because each open sheet renders one `sheet` testID, counting them is how these
 * tests assert "one sheet at a time".
 */
jest.mock('../native-sheet', () => {
  const actual = jest.requireActual('../native-sheet')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, Pressable } = require('react-native')
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
          <Pressable testID="sheet-dismiss" onPress={onClose}>
            <Text>Dismiss</Text>
          </Pressable>
          {children}
        </View>
      ) : null,
  }
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider appKey="test-key" theme="light">
    {children}
  </YouVersionProvider>
)

async function selectVerses(selection: BibleReaderVerseSelection = SELECTION) {
  mockNextSelection = selection
  await act(async () => {
    fireEvent.press(screen.getByTestId('trigger-verse-select'))
  })
}

async function press(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID))
  })
}

function openSheetCount() {
  return screen.queryAllByTestId('sheet').length
}

beforeEach(() => {
  mockNextSelection = SELECTION
  flowApply.mockClear()
  flowConfirm.mockClear()
  flowDecline.mockClear()
  rawApply.mockClear()
  rawRemove.mockClear()
  stubFlow()
  useReaderLocationStore.setState(readerLocationStoreInitialState)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('BibleReader — the sign-in pre-step', () => {
  it('trades the action sheet for the sign-in sheet, one at a time', async () => {
    stubAuth(false)
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    expect(screen.getByTestId('bible-verse-action-sheet')).toBeTruthy()

    await press(`bible-verse-action-swatch-apply-${GREEN}`)

    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()
    expect(screen.getByTestId('sign-in-with-youversion-sheet')).toBeTruthy()
    // Two live sheets means the loser was displaced, and displacement fires
    // `closeVerseActions` — which would bump the clear signal underneath a
    // prompt that has not been answered yet.
    expect(openSheetCount()).toBe(1)
  })

  it('writes nothing until the user says yes', async () => {
    stubAuth(false)
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)

    expect(flowApply).not.toHaveBeenCalled()
    expect(rawApply).not.toHaveBeenCalled()
  })

  it('replays the stashed intent through the flow on confirm', async () => {
    stubAuth(false)
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)
    await press('sign-in-with-youversion-confirm')

    // The color and verses survive the round-trip: the user does not reselect.
    expect(flowApply).toHaveBeenCalledWith(GREEN, [1, 2])
    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
  })

  it('discards the intent on "No Thanks"', async () => {
    stubAuth(false)
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)
    await press('sign-in-with-youversion-decline')

    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
    expect(flowApply).not.toHaveBeenCalled()
    expect(rawApply).not.toHaveBeenCalled()
    expect(openSheetCount()).toBe(0)
  })

  it('discards the intent on a swipe-down or backdrop tap too', async () => {
    stubAuth(false)
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)
    await press('sheet-dismiss')

    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
    expect(flowApply).not.toHaveBeenCalled()
  })

  it('leaves a dismissed intent behind — a later press starts over', async () => {
    stubAuth(false)
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)
    await press('sign-in-with-youversion-decline')

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${BLUE}`)
    await press('sign-in-with-youversion-confirm')

    // The green intent is gone, not queued behind the blue one.
    expect(flowApply).toHaveBeenCalledTimes(1)
    expect(flowApply).toHaveBeenCalledWith(BLUE, [1, 2])
  })

  it('never prompts for a remove', async () => {
    stubAuth(false)
    stubFlow({ highlights: [highlight(1, BLUE), highlight(2, BLUE)] })
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    await press(`bible-verse-action-swatch-remove-${BLUE}`)

    // ADR 0016: a user looking at their own highlight already has whatever the
    // write needs, so removal skips both prompts.
    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
    expect(screen.queryByTestId('highlight-consent-sheet')).toBeNull()
    expect(rawRemove).toHaveBeenCalledWith(BLUE, [1, 2])
  })

  it('goes straight to the flow for a signed-in user', async () => {
    stubAuth(true)
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)

    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
    expect(flowApply).toHaveBeenCalledWith(GREEN, [1, 2])
  })

  /**
   * No `auth` config is not "signed out" — there is nothing to sign in to, and
   * the flow's own `apply` warns and falls through to the unguarded write. A
   * prompt here would open a sheet whose only outcome is the one the user
   * already had.
   */
  it('does not prompt a consumer who configured no auth', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)

    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
    expect(flowApply).toHaveBeenCalledWith(GREEN, [1, 2])
  })
})

describe('BibleReader — the consent step', () => {
  it('opens on isConfirming and closes the action sheet with it', async () => {
    stubAuth(true)
    stubFlow({ isConfirming: true })
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()

    expect(screen.getByTestId('highlight-consent-sheet')).toBeTruthy()
    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()
    expect(openSheetCount()).toBe(1)
  })

  it('hands Continue to confirm()', async () => {
    stubAuth(true)
    stubFlow({ isConfirming: true })
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await press('highlight-consent-confirm')

    expect(flowConfirm).toHaveBeenCalledTimes(1)
    expect(flowDecline).not.toHaveBeenCalled()
  })

  it('hands Cancel to decline()', async () => {
    stubAuth(true)
    stubFlow({ isConfirming: true })
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await press('highlight-consent-cancel')

    expect(flowDecline).toHaveBeenCalledTimes(1)
    expect(flowConfirm).not.toHaveBeenCalled()
  })

  /**
   * The backdrop tap, the pan-down, and displacement by another sheet are one
   * handler on `NativeSheet`. A path that skipped `decline()` would strand the
   * flow with `isConfirming` still true and no sheet on screen.
   */
  it('hands the backdrop, pan-down and displacement paths to decline()', async () => {
    stubAuth(true)
    stubFlow({ isConfirming: true })
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await press('sheet-dismiss')

    expect(flowDecline).toHaveBeenCalledTimes(1)
    expect(flowConfirm).not.toHaveBeenCalled()
  })
})
