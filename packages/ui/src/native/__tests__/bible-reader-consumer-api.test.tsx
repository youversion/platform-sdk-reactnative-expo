/**
 * Consumer-facing BibleReader seams: refreshHighlights ref handle and onHighlightError.
 */
import { act, fireEvent, render } from '@testing-library/react-native'
import type { HighlightWriteOutcome } from '@youversion/platform-react-native-expo-core'
import * as core from '@youversion/platform-react-native-expo-core'
import type { BibleReaderVerseSelection } from '@youversion/platform-react-ui'
import { createRef, type ReactNode } from 'react'

import { BibleReader, type BibleReaderHandle } from '../bible-reader'
import { YouVersionProvider } from '../youversion-provider'

const VERSION_ID = 111

const SELECTION: BibleReaderVerseSelection = {
  versionId: VERSION_ID,
  book: 'JHN',
  chapter: '1',
  verses: [1, 2],
  passageIds: ['JHN.1.1', 'JHN.1.2'],
  reference: 'John 1:1-2',
  shareData: null,
}

const highlightPermissionFlowApply = jest.fn<
  Promise<HighlightWriteOutcome>,
  [string, number[]]
>(async () => ({ status: 'ok', verses: [1, 2] }))
const rawRemove = jest.fn<Promise<HighlightWriteOutcome>, [string, number[]]>(
  async () => ({ status: 'ok', verses: [1, 2] }),
)
const refreshHighlights = jest.fn(async () => undefined)

function stubHighlightPermissionFlow() {
  jest
    .spyOn(core, 'useHighlightPermissionFlow')
    .mockImplementation(({ versionId, book, chapter }) => ({
      highlights: {
        highlights: [],
        scope: { versionId, book, chapter },
        isRefreshing: false,
        error: null,
        refresh: refreshHighlights,
        apply: jest.fn(),
        remove: rawRemove,
      },
      isConfirming: false,
      apply: highlightPermissionFlowApply,
      confirm: jest.fn(),
      decline: jest.fn(),
      flowError: null,
    }))
}

jest.mock('../../dom/bible-reader', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, Pressable } = require('react-native')
  return {
    __esModule: true,
    default: function MockDOM(props: {
      onVerseSelect?: (verseSelection: BibleReaderVerseSelection) => Promise<void>
    }) {
      return (
        <View testID="mock-dom">
          <Pressable
            testID="trigger-verse-select"
            onPress={() => void props.onVerseSelect?.(SELECTION)}
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
  return { __esModule: true, default: () => <View testID="mock-footnote" /> }
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
  return { __esModule: true, BibleReaderSettingsSheet: () => <View testID="mock-settings-sheet" /> }
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

jest.mock('../bible-verse-action-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Pressable, Text } = require('react-native')
  return {
    __esModule: true,
    BibleVerseActionSheet: (props: {
      isOpen: boolean
      onSwatchPress: (swatch: { color: string; state: 'apply' | 'remove' }) => void
    }) =>
      props.isOpen ? (
        <View testID="verse-action-sheet">
          <Pressable
            testID="trigger-apply-swatch"
            onPress={() => props.onSwatchPress({ color: 'fffe00', state: 'apply' })}
          >
            <Text>Apply</Text>
          </Pressable>
          <Pressable
            testID="trigger-remove-swatch"
            onPress={() => props.onSwatchPress({ color: 'fffe00', state: 'remove' })}
          >
            <Text>Remove</Text>
          </Pressable>
        </View>
      ) : null,
  }
})

jest.mock('../sign-in-with-youversion-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return { __esModule: true, SignInWithYouVersionSheet: () => <View testID="mock-sign-in-sheet" /> }
})

jest.mock('../highlight-consent-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return { __esModule: true, HighlightConsentSheet: () => <View testID="mock-consent-sheet" /> }
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider appKey="test-key" theme="light">
    {children}
  </YouVersionProvider>
)

beforeEach(() => {
  highlightPermissionFlowApply.mockClear()
  rawRemove.mockClear()
  refreshHighlights.mockClear()
  stubHighlightPermissionFlow()
  jest.spyOn(core, 'useYVAuthOptional').mockReturnValue({
    isAuthenticated: true,
    accessToken: 'token',
    userInfo: { id: 'user-1' },
    error: null,
    signIn: jest.fn(async () => undefined),
    signOut: jest.fn(async () => undefined),
    refreshNow: jest.fn(async () => undefined),
    ensureFreshToken: jest.fn(async () => undefined),
    getAccessToken: jest.fn(
      async () => ({ status: 'ok', token: 'token', userId: 'user-1' }) as const,
    ),
    isLoading: false,
    requestedPermissions: ['highlights'],
    grantedPermissions: ['highlights'],
    hasPermission: () => true,
    invalidatePermissions: jest.fn(),
    requestPermissions: jest.fn(async () => ({ status: 'cancel' }) as const),
  })
})

afterEach(() => {
  jest.restoreAllMocks()
})

async function selectVerses(getByTestId: (id: string) => Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(getByTestId('trigger-verse-select'))
  })
}

describe('BibleReader consumer API', () => {
  it('refreshHighlights calls through to highlights.refresh', async () => {
    const reader = createRef<BibleReaderHandle>()

    render(<BibleReader ref={reader} book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    expect(reader.current).not.toBeNull()
    expect(refreshHighlights).not.toHaveBeenCalled()

    await act(async () => {
      await reader.current?.refreshHighlights()
    })

    expect(refreshHighlights).toHaveBeenCalledTimes(1)
  })

  it('exposes nothing beyond refreshHighlights on the ref handle', () => {
    const reader = createRef<BibleReaderHandle>()

    render(<BibleReader ref={reader} book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    expect(Object.keys(reader.current ?? {})).toEqual(['refreshHighlights'])
  })

  it('onHighlightError fires for queued apply outcomes', async () => {
    highlightPermissionFlowApply.mockResolvedValueOnce({ status: 'queued', verses: [1, 2] })
    const onHighlightError = jest.fn()

    const { getByTestId } = render(
      <BibleReader
        book="JHN"
        chapter="1"
        versionId={VERSION_ID}
        onHighlightError={onHighlightError}
      />,
      { wrapper },
    )

    await selectVerses(getByTestId)
    await act(async () => {
      fireEvent.press(getByTestId('trigger-apply-swatch'))
    })

    expect(onHighlightError).toHaveBeenCalledWith({ status: 'queued', verses: [1, 2] })
  })

  it('onHighlightError fires for transient error outcomes on remove', async () => {
    rawRemove.mockResolvedValueOnce({
      status: 'error',
      reason: 'transient',
      message: 'Network request failed',
      failedVerses: [1, 2],
      succeededVerses: [],
    })
    const onHighlightError = jest.fn()

    const { getByTestId } = render(
      <BibleReader
        book="JHN"
        chapter="1"
        versionId={VERSION_ID}
        onHighlightError={onHighlightError}
      />,
      { wrapper },
    )

    await selectVerses(getByTestId)
    await act(async () => {
      fireEvent.press(getByTestId('trigger-remove-swatch'))
    })

    expect(onHighlightError).toHaveBeenCalledWith({
      status: 'error',
      reason: 'transient',
      verses: [1, 2],
      message: 'Network request failed',
    })
  })
})
