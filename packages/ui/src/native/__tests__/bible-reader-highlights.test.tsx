import { act, fireEvent, render } from '@testing-library/react-native'
import type {
  Highlight,
  HighlightScope,
  HighlightWriteOutcome,
} from '@youversion/platform-react-native-expo-core'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import type { BibleReaderHighlightIntent } from '@youversion/platform-react-ui'
import { createRef, type ReactNode } from 'react'

import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import { resetAuthMock, setMockAuth, setMockSignedIn } from '../../test-utils/auth-mock'
import {
  highlightsMock,
  resetHighlightsMock,
  setMockHighlights,
} from '../../test-utils/highlights-mock'
import type { BibleReaderHandle } from '../bible-reader'
import { BibleReader } from '../bible-reader'
import { YouVersionProvider } from '../youversion-provider'

/**
 * Every `highlights` value the DOM component has ever been handed. The Web SDK
 * latches controlled mode on the prop's presence at first mount, so a single
 * `undefined` frame — mid-chapter-change, mid-sign-in — would silently drop the
 * reader into self-contained mode. Asserting the latest value is not enough;
 * the whole history has to be arrays.
 */
const mockHighlightsHistory: (Highlight[] | undefined)[] = []

const VERSION_ID = 111

let latestDomProps: {
  highlights?: Highlight[]
  book?: string
  chapter?: string
  versionId?: number
} = {}

/**
 * The intent the mocked swatch triggers emit. The Web SDK builds this inside the
 * WebView from its own selection state, so tests set it directly to stand in for
 * "the user selected these verses and tapped this color".
 */
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
      highlights?: Highlight[]
      book?: string
      chapter?: string
      versionId?: number
      onChapterChange?: (chapter: string) => Promise<void>
      onHighlightApply?: (intent: BibleReaderHighlightIntent) => Promise<void>
      onHighlightRemove?: (intent: BibleReaderHighlightIntent) => Promise<void>
    }) {
      latestDomProps = props
      mockHighlightsHistory.push(props.highlights)
      return (
        <View testID="mock-dom">
          <Text testID="highlight-count">{String(props.highlights?.length ?? 'undefined')}</Text>
          <Text testID="chapter">{props.chapter ?? 'none'}</Text>
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

jest.mock('../bible-reader-settings-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    __esModule: true,
    BibleReaderSettingsSheet: () => <View testID="mock-settings-sheet" />,
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

const JHN_1_HIGHLIGHTS: Highlight[] = [
  { version_id: VERSION_ID, passage_id: 'JHN.1.1', color: 'fffe00' },
  { version_id: VERSION_ID, passage_id: 'JHN.1.2', color: 'fffe00' },
]

const JHN_3_HIGHLIGHTS: Highlight[] = [
  { version_id: VERSION_ID, passage_id: 'JHN.3.16', color: '00d6ff' },
]

function highlightsForScope(scope: HighlightScope): Highlight[] {
  if (scope.book !== 'JHN' || scope.versionId !== VERSION_ID) return []
  if (scope.chapter === '1') return JHN_1_HIGHLIGHTS
  if (scope.chapter === '3') return JHN_3_HIGHLIGHTS
  return []
}

beforeEach(async () => {
  latestDomProps = {}
  mockHighlightsHistory.length = 0
  mockNextIntent = JHN_1_INTENT
  resetHighlightsMock()
  resetAuthMock()
  mmkvStorage.clearAll()
  useReaderLocationStore.setState(readerLocationStoreInitialState)
  await useReaderLocationStore.persist.rehydrate()
})

describe('BibleReader highlights read path', () => {
  it('passes the hook’s highlights straight through to the DOM component', () => {
    setMockHighlights(JHN_1_HIGHLIGHTS)

    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    expect(latestDomProps.highlights).toBe(JHN_1_HIGHLIGHTS)
  })

  it('passes an empty array — never undefined — when signed out', () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    expect(latestDomProps.highlights).toEqual([])
    expect(mockHighlightsHistory.every(Array.isArray)).toBe(true)
  })

  it('never hands the DOM component undefined across re-render, chapter change, or auth change', async () => {
    setMockHighlights(highlightsForScope)

    const { rerender, getByTestId } = render(<BibleReader versionId={VERSION_ID} />, { wrapper })

    // Plain re-render.
    rerender(<BibleReader versionId={VERSION_ID} />)

    // Chapter change driven from inside the WebView, as the reader does.
    await act(async () => {
      fireEvent.press(getByTestId('trigger-chapter-change'))
    })

    // Sign-out: the hook starts reporting nothing for every scope.
    setMockHighlights([])
    rerender(<BibleReader versionId={VERSION_ID} />)

    // Sign-in: data comes back.
    setMockHighlights(highlightsForScope)
    rerender(<BibleReader versionId={VERSION_ID} />)

    expect(mockHighlightsHistory.length).toBeGreaterThan(4)
    expect(mockHighlightsHistory.every(Array.isArray)).toBe(true)
  })

  it('re-scopes to the new chapter’s highlights when the chapter changes', async () => {
    setMockHighlights(highlightsForScope)

    // Uncontrolled: the reader owns the chapter, so the DOM-driven change lands.
    const { getByTestId } = render(<BibleReader versionId={VERSION_ID} />, { wrapper })

    expect(latestDomProps.chapter).toBe('1')
    expect(latestDomProps.highlights).toBe(JHN_1_HIGHLIGHTS)

    await act(async () => {
      fireEvent.press(getByTestId('trigger-chapter-change'))
    })

    expect(latestDomProps.chapter).toBe('3')
    expect(latestDomProps.highlights).toBe(JHN_3_HIGHLIGHTS)
  })
})

describe('BibleReader highlights write path', () => {
  async function tap(getByTestId: (id: string) => Parameters<typeof fireEvent.press>[0]) {
    await act(async () => {
      fireEvent.press(getByTestId('trigger-highlight-apply'))
    })
  }

  it('routes an apply intent into the hook with the tapped color and verses', async () => {
    setMockSignedIn()

    const { getByTestId } = render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, {
      wrapper,
    })

    await tap(getByTestId)

    expect(highlightsMock.apply).toHaveBeenCalledTimes(1)
    expect(highlightsMock.apply).toHaveBeenCalledWith('fffe00', [1, 2])
    expect(highlightsMock.remove).not.toHaveBeenCalled()
  })

  it('routes a remove intent into the hook, carrying the color being cleared', async () => {
    setMockSignedIn()
    mockNextIntent = { ...JHN_1_INTENT, color: '00d6ff', verses: [2], passageIds: ['JHN.1.2'] }

    const { getByTestId } = render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, {
      wrapper,
    })

    await act(async () => {
      fireEvent.press(getByTestId('trigger-highlight-remove'))
    })

    expect(highlightsMock.remove).toHaveBeenCalledWith('00d6ff', [2])
    expect(highlightsMock.apply).not.toHaveBeenCalled()
  })

  it('drops an intent whose scope no longer matches the chapter on screen', async () => {
    setMockSignedIn()
    // The tap was made in JHN 1 but lands after the reader moved to JHN 3.
    mockNextIntent = { ...JHN_1_INTENT, chapter: '1' }

    const { getByTestId } = render(<BibleReader book="JHN" chapter="3" versionId={VERSION_ID} />, {
      wrapper,
    })

    await tap(getByTestId)

    expect(highlightsMock.apply).not.toHaveBeenCalled()
  })

  it('drops an intent for a different version', async () => {
    setMockSignedIn()
    mockNextIntent = { ...JHN_1_INTENT, versionId: 206 }

    const { getByTestId } = render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, {
      wrapper,
    })

    await tap(getByTestId)

    expect(highlightsMock.apply).not.toHaveBeenCalled()
  })

  it('does nothing when auth is not configured on the provider', async () => {
    const { getByTestId } = render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, {
      wrapper,
    })

    await tap(getByTestId)

    expect(highlightsMock.apply).not.toHaveBeenCalled()
  })

  it('writes nothing when signed out — the tap routes to the sign-in prompt instead', async () => {
    setMockAuth({ isAuthConfigured: true })

    const { getByTestId } = render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, {
      wrapper,
    })

    await tap(getByTestId)

    expect(highlightsMock.apply).not.toHaveBeenCalled()
  })

  it('writes during the token-loading window, when userInfo is seeded but the token is not', async () => {
    // `AuthProvider` hydrates `userInfo` synchronously and loads the token
    // asynchronously. The user IS signed in here; gating on the token would send
    // them to a sign-in prompt they do not need.
    setMockAuth({
      isAuthConfigured: true,
      isAuthenticated: false,
      accessToken: null,
      userInfo: { id: 'test-user-id' },
      grantedPermissions: ['highlights'],
      isLoading: true,
    })

    const { getByTestId } = render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, {
      wrapper,
    })

    await tap(getByTestId)

    expect(highlightsMock.apply).toHaveBeenCalledWith('fffe00', [1, 2])
  })

  it('reports a transient failure through onHighlightError', async () => {
    setMockSignedIn()
    const outcome: HighlightWriteOutcome = {
      status: 'error',
      reason: 'transient',
      message: 'Network request failed',
      failedVerses: [1, 2],
      succeededVerses: [],
    }
    highlightsMock.apply.mockResolvedValueOnce(outcome)
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

    await tap(getByTestId)

    expect(onHighlightError).toHaveBeenCalledWith(outcome)
  })

  it('logs an invalid failure instead of reporting it — the user cannot act on it', async () => {
    setMockSignedIn()
    highlightsMock.apply.mockResolvedValueOnce({
      status: 'error',
      reason: 'invalid',
      message: 'Unsupported highlight color.',
      failedVerses: [1, 2],
      succeededVerses: [],
    })
    const onHighlightError = jest.fn()
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

    const { getByTestId } = render(
      <BibleReader
        book="JHN"
        chapter="1"
        versionId={VERSION_ID}
        onHighlightError={onHighlightError}
      />,
      { wrapper },
    )

    await tap(getByTestId)

    expect(onHighlightError).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalled()

    consoleError.mockRestore()
  })

  it('stays silent on an auth failure — that branch belongs to the permission prompt', async () => {
    setMockSignedIn()
    highlightsMock.apply.mockResolvedValueOnce({
      status: 'error',
      reason: 'auth',
      message: 'Request failed with status 403',
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

    await tap(getByTestId)

    expect(onHighlightError).not.toHaveBeenCalled()
  })

  it('reports nothing on a successful write', async () => {
    setMockSignedIn()
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

    await tap(getByTestId)

    expect(onHighlightError).not.toHaveBeenCalled()
  })
})

describe('BibleReader refreshHighlights handle', () => {
  it('calls through to core’s refresh so a host can revalidate on navigation focus', async () => {
    setMockSignedIn()
    const reader = createRef<BibleReaderHandle>()

    render(<BibleReader ref={reader} book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    expect(reader.current).not.toBeNull()
    expect(highlightsMock.refresh).not.toHaveBeenCalled()

    await act(async () => {
      await reader.current?.refreshHighlights()
    })

    expect(highlightsMock.refresh).toHaveBeenCalledTimes(1)
  })

  it('keeps working after a chapter change — the handle is not captured at mount', async () => {
    setMockSignedIn()
    setMockHighlights(highlightsForScope)
    const reader = createRef<BibleReaderHandle>()

    const { getByTestId } = render(<BibleReader ref={reader} versionId={VERSION_ID} />, { wrapper })

    await act(async () => {
      fireEvent.press(getByTestId('trigger-chapter-change'))
    })
    expect(latestDomProps.chapter).toBe('3')

    await act(async () => {
      await reader.current?.refreshHighlights()
    })

    expect(highlightsMock.refresh).toHaveBeenCalledTimes(1)
  })

  it('exposes nothing beyond the refresh handle', () => {
    const reader = createRef<BibleReaderHandle>()

    render(<BibleReader ref={reader} book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    expect(Object.keys(reader.current ?? {})).toEqual(['refreshHighlights'])
  })
})
