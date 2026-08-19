/**
 * Consumer-facing BibleReader seams: refreshHighlights ref handle and onHighlightError.
 */
import type {
  HighlightWriteOutcome,
  HookOverrides,
  UseHighlightsOptions,
} from '@youversion/platform-react-native-expo-core'
import { act, fireEvent, render } from '@testing-library/react-native'
import type { BibleReaderVerseSelection } from '@youversion/platform-react-ui'
import { createRef } from 'react'
import { Pressable, Text, View } from 'react-native'

import {
  defaultPermissionFlow,
  emptyHighlights,
  signedOutAuth,
} from '../../test-utils/default-hook-overrides'
import {
  installBibleReaderTestImpls,
  resetImpls,
  setImpls,
} from '../../test-utils/install-test-impls'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleReader, type BibleReaderHandle } from '../bible-reader'

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

function permissionFlow(options: UseHighlightsOptions) {
  return {
    ...defaultPermissionFlow(options),
    highlights: {
      ...emptyHighlights(options),
      refresh: refreshHighlights,
      remove: rawRemove,
    },
    apply: highlightPermissionFlowApply,
  }
}

const hookOverrides: HookOverrides = {
  useYVAuth: signedOutAuth({
    isAuthenticated: true,
    accessToken: 'token',
    userInfo: { id: 'user-1' },
    getAccessToken: async () => ({ status: 'ok', token: 'token', userId: 'user-1' }),
    requestedPermissions: ['highlights'],
    grantedPermissions: ['highlights'],
    hasPermission: () => true,
  }),
  useHighlightPermissionFlow: permissionFlow,
}

const wrapper = youVersionProviderWrapper('light', undefined, hookOverrides)

function MockDOM(props: {
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
}

beforeEach(() => {
  highlightPermissionFlowApply.mockClear()
  rawRemove.mockClear()
  refreshHighlights.mockClear()
  installBibleReaderTestImpls()
  setImpls({
    BibleReaderDom: MockDOM,
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
  })
})

afterEach(() => {
  resetImpls()
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
