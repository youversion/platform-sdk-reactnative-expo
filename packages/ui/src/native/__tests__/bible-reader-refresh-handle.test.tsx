/**
 * Layer 3 — the imperative handle a host uses to refresh highlights.
 *
 * Foreground refresh is the hook's own business (core subscribes to `AppState`).
 * Navigation focus is not: detecting it would force `@react-navigation/native`
 * on every consumer, so the reader exposes `refreshHighlights()` and the host
 * calls it. What this pins is that the handle reaches core's `refresh`
 * untouched, promise included — a host driving a `RefreshControl` awaits it.
 */
import { act, render } from '@testing-library/react-native'
import * as core from '@youversion/platform-react-native-expo-core'
import { createRef, type ReactNode } from 'react'

import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import { BibleReader, type BibleReaderHandle } from '../bible-reader'
import { YouVersionProvider } from '../youversion-provider'

jest.mock('../../dom/bible-reader', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return { __esModule: true, default: () => <View testID="mock-dom" /> }
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

// Spread from the real module so `NativeSheetProvider` survives; the sheets are
// not what this suite is about.
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

const refresh = jest.fn(async () => undefined)

/**
 * `jest.setup.js` stubs this hook globally (the real one needs core's own
 * provider, which UI tests replace). Steer it here rather than re-mocking the
 * whole package and losing that passthrough provider.
 */
function stubHighlightPermissionFlow() {
  jest
    .spyOn(core, 'useHighlightPermissionFlow')
    .mockImplementation(({ versionId, book, chapter }) => ({
      highlights: {
        highlights: [],
        scope: { versionId, book, chapter },
        isRefreshing: false,
        error: null,
        refresh,
        apply: jest.fn(async () => ({ status: 'noop' }) as const),
        remove: jest.fn(async () => ({ status: 'noop' }) as const),
      },
      isConfirming: false,
      apply: jest.fn(async () => ({ status: 'noop' }) as const),
      confirm: jest.fn(),
      decline: jest.fn(),
      flowError: null,
    }))
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider appKey="test-key" theme="light">
    {children}
  </YouVersionProvider>
)

beforeEach(async () => {
  jest.clearAllMocks()
  refresh.mockResolvedValue(undefined)
  stubHighlightPermissionFlow()
  useReaderLocationStore.setState(readerLocationStoreInitialState)
  await useReaderLocationStore.persist.rehydrate()
})

describe('BibleReaderHandle', () => {
  it('exposes refreshHighlights on the ref', () => {
    const ref = createRef<BibleReaderHandle>()
    render(<BibleReader ref={ref} />, { wrapper })

    expect(typeof ref.current?.refreshHighlights).toBe('function')
  })

  it('hands back core’s own promise, not a fire-and-forget wrapper', async () => {
    // Identity, not just "it resolves": a wrapper that called `refresh()` and
    // returned a fresh promise would satisfy every other assertion here while
    // resolving before the GET does — and a host's RefreshControl would stop
    // spinning early. `refresh` never rejects, so passing it through is also
    // what keeps `refreshHighlights` free of a rejection a host must catch.
    const pending = Promise.resolve(undefined)
    refresh.mockReturnValue(pending)

    const ref = createRef<BibleReaderHandle>()
    render(<BibleReader ref={ref} />, { wrapper })

    await act(async () => {
      expect(ref.current?.refreshHighlights()).toBe(pending)
      await pending
    })

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('clears the handle on unmount', () => {
    const ref = createRef<BibleReaderHandle>()
    const { unmount } = render(<BibleReader ref={ref} />, { wrapper })

    unmount()
    expect(ref.current).toBeNull()
  })
})
