/**
 * Layer 3 — the native → Expo DOM contract for natively-owned highlights.
 *
 * The security property the epic rests on ("no highlight API call originates in
 * the WebView") is the Web SDK's controlled-mode guarantee, and it is latched by
 * the *presence* of the `highlights` prop at first mount. Our half of that
 * bargain is never handing the DOM component `undefined` — not on the first
 * frame, not before auth resolves, not across a chapter change. That is what
 * this suite pins.
 */
import { act, fireEvent, render } from '@testing-library/react-native'
import type { Highlight } from '@youversion/platform-react-native-expo-core'
import * as core from '@youversion/platform-react-native-expo-core'
import type { BibleReaderVerseSelection } from '@youversion/platform-react-ui'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactNode } from 'react'

import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import { BibleReader } from '../bible-reader'
import { YouVersionProvider } from '../youversion-provider'

type CapturedDomProps = {
  highlights?: unknown
  versionId?: number
  book?: string
  chapter?: string
  clearSelectionSignal?: number
  onVerseSelect?: (selection: BibleReaderVerseSelection) => Promise<void>
  onChapterChange?: (chapter: string) => Promise<void>
}

/** Every render's props, so "always an array" can be checked, not just "eventually". */
let mockDomPropsHistory: CapturedDomProps[] = []

/**
 * Read at press time, not at factory time, so `beforeEach` can swap it without
 * tripping the mock-factory hoist.
 */
let mockVerseSelection: BibleReaderVerseSelection

jest.mock('../../dom/bible-reader', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Pressable, Text } = require('react-native')
  return {
    __esModule: true,
    default: function MockDOM(props: CapturedDomProps) {
      mockDomPropsHistory.push(props)
      return (
        <View testID="mock-dom">
          <Pressable
            testID="trigger-verse-select"
            onPress={() => props.onVerseSelect?.(mockVerseSelection)}
          >
            <Text>Select</Text>
          </Pressable>
          <Pressable testID="trigger-chapter-change" onPress={() => props.onChapterChange?.('4')}>
            <Text>Next chapter</Text>
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

jest.mock('../../stores/reader-settings-store', () => ({
  useReaderSettingsStore: () => ({
    fontSize: 16,
    fontFamily: '"Inter", sans-serif',
    lineSpacing: 1.5,
    setFontSize: jest.fn(),
    setFontFamily: jest.fn(),
    setLineSpacing: jest.fn(),
  }),
}))

const YELLOW = 'fffe00'

function highlight(passageId: string, versionId = 111): Highlight {
  return { version_id: versionId, passage_id: passageId, color: YELLOW }
}

/**
 * The hook is already stubbed signed-out-shaped in `jest.setup.js` (the real one
 * needs core's own provider, which UI tests replace). Steer it per test rather
 * than re-mocking the whole package and losing that passthrough provider.
 */
const useHighlightsSpy = jest.spyOn(core, 'useHighlights')

function stubHighlights(highlights: Highlight[]) {
  useHighlightsSpy.mockImplementation(({ versionId, book, chapter }) => ({
    highlights,
    scope: { versionId, book, chapter },
    isRefreshing: false,
    error: null,
    refresh: jest.fn(async () => undefined),
    apply: jest.fn(async () => ({ status: 'noop' }) as const),
    remove: jest.fn(async () => ({ status: 'noop' }) as const),
  }))
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider appKey="test-key" theme="light">
    {children}
  </YouVersionProvider>
)

function lastDomProps(): CapturedDomProps {
  const props = mockDomPropsHistory.at(-1)
  if (props === undefined) {
    throw new Error('The DOM component never rendered.')
  }
  return props
}

beforeEach(async () => {
  mockDomPropsHistory = []
  mockVerseSelection = {
    versionId: 111,
    book: 'HEB',
    chapter: '11',
    verses: [4, 5],
    passageIds: ['HEB.11.4', 'HEB.11.5'],
    reference: 'Hebrews 11:4-5',
    shareData: {
      text: '“By faith…”\n\nHebrews 11:4-5 BSB',
      reference: 'Hebrews 11:4-5 BSB',
      verseText: 'By faith…',
      verses: [4, 5],
      book: 'HEB',
      chapter: '11',
      versionId: 111,
    },
  }
  stubHighlights([])
  mmkvStorage.clearAll()
  useReaderLocationStore.setState(readerLocationStoreInitialState)
  await useReaderLocationStore.persist.rehydrate()
})

afterAll(() => {
  useHighlightsSpy.mockRestore()
})

describe('the controlled-mode latch', () => {
  it('hands the DOM component an array on the very first render', () => {
    render(<BibleReader />, { wrapper })

    expect(mockDomPropsHistory.length).toBeGreaterThan(0)
    expect(Array.isArray(mockDomPropsHistory[0]?.highlights)).toBe(true)
  })

  it('never renders with an undefined highlights prop, on any render', async () => {
    stubHighlights([highlight('JHN.3.16')])
    const { getByTestId } = render(<BibleReader />, { wrapper })

    await act(async () => {
      fireEvent.press(getByTestId('trigger-chapter-change'))
    })

    expect(mockDomPropsHistory.length).toBeGreaterThan(1)
    for (const props of mockDomPropsHistory) {
      expect(Array.isArray(props.highlights)).toBe(true)
    }
  })

  // The hook is stubbed, so this pins the wrapper's pass-through, not the hook's
  // no-auth behaviour — core covers that in `use-highlights.test.tsx`.
  it('passes an empty hook result through as [], never undefined', () => {
    render(<BibleReader />, { wrapper })
    expect(lastDomProps().highlights).toEqual([])
  })

  it('forwards the hook’s highlights verbatim, with no adapter in between', () => {
    const data = [highlight('JHN.3.16'), highlight('JHN.3.17-18')]
    stubHighlights(data)

    render(<BibleReader />, { wrapper })

    expect(lastDomProps().highlights).toEqual(data)
  })
})

describe('the highlights subscription scope', () => {
  it('subscribes to the reader’s current location', () => {
    render(<BibleReader defaultBook="ROM" defaultChapter="8" defaultVersionId={111} />, { wrapper })

    expect(useHighlightsSpy).toHaveBeenCalledWith({ versionId: 111, book: 'ROM', chapter: '8' })
  })

  it('re-scopes when the WebView navigates to another chapter', async () => {
    const { getByTestId } = render(<BibleReader defaultBook="ROM" defaultChapter="8" />, {
      wrapper,
    })

    await act(async () => {
      fireEvent.press(getByTestId('trigger-chapter-change'))
    })

    expect(useHighlightsSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ book: 'ROM', chapter: '4' }),
    )
  })
})

describe('the verse-action event set', () => {
  it('sends no highlight-intent or copy/share handlers across the bridge', () => {
    render(<BibleReader />, { wrapper })

    const props = lastDomProps()
    expect(props).not.toHaveProperty('onHighlightApply')
    expect(props).not.toHaveProperty('onHighlightRemove')
    expect(props).not.toHaveProperty('onCopy')
    expect(props).not.toHaveProperty('onShare')
  })

  it('does not let a consumer choose the verse-action UI', () => {
    render(<BibleReader />, { wrapper })
    expect(lastDomProps()).not.toHaveProperty('verseActions')
  })
})

describe('onVerseSelect', () => {
  it('reaches the consumer prop', async () => {
    const onVerseSelect = jest.fn(async () => undefined)
    const { getByTestId } = render(<BibleReader onVerseSelect={onVerseSelect} />, { wrapper })

    await act(async () => {
      fireEvent.press(getByTestId('trigger-verse-select'))
    })

    expect(onVerseSelect).toHaveBeenCalledWith(mockVerseSelection)
  })

  it('carries a payload that survives the bridge unchanged', async () => {
    const onVerseSelect = jest.fn(async (_selection: BibleReaderVerseSelection) => undefined)
    const { getByTestId } = render(<BibleReader onVerseSelect={onVerseSelect} />, { wrapper })

    await act(async () => {
      fireEvent.press(getByTestId('trigger-verse-select'))
    })

    const received = onVerseSelect.mock.calls[0]![0]
    // Only JSON-safe primitives cross an Expo DOM boundary; anything that did
    // not survive this round-trip would arrive mangled or missing on device.
    expect(JSON.parse(JSON.stringify(received))).toEqual(received)
    // The localized reference is the label a host renders; the USFM book code is
    // not human-readable and must not be what arrives.
    expect(received.reference).toBe('Hebrews 11:4-5')
  })

  it('is absent from the DOM props when the consumer passes no handler', () => {
    render(<BibleReader />, { wrapper })
    expect(lastDomProps().onVerseSelect).toBeUndefined()
  })
})

describe('clearSelectionSignal', () => {
  it('crosses the bridge as a number', () => {
    render(<BibleReader clearSelectionSignal={0} />, { wrapper })
    expect(lastDomProps().clearSelectionSignal).toBe(0)
  })

  it('forwards each increment', () => {
    const { rerender } = render(<BibleReader clearSelectionSignal={0} />, { wrapper })
    expect(lastDomProps().clearSelectionSignal).toBe(0)

    rerender(<BibleReader clearSelectionSignal={1} />)
    expect(lastDomProps().clearSelectionSignal).toBe(1)
  })

  it('stays undefined when the consumer never clears', () => {
    render(<BibleReader />, { wrapper })
    expect(lastDomProps().clearSelectionSignal).toBeUndefined()
  })
})

/**
 * `verseActions="none"` is set inside the `'use dom'` file, on the Web SDK root
 * — it never crosses the bridge, so no test that mocks the DOM component (i.e.
 * every layer-3 test) can observe it, and this repo has no jsdom project to
 * render the real thing in. This reads the source instead. Crude, but the line
 * it guards is the one that keeps a second verse-action popover from stacking
 * over the native sheet and keeps the Web SDK's own highlight writes switched
 * off; leaving it with no regression guard at all was the worse trade.
 */
describe('the DOM component source (unobservable from layer 3)', () => {
  const source = readFileSync(join(__dirname, '../../dom/bible-reader.tsx'), 'utf8')

  it('hardcodes verseActions="none" on the Web SDK reader root', () => {
    expect(source).toContain('verseActions="none"')
  })

  it('wires no Web SDK highlight-intent or copy/share handlers', () => {
    expect(source).not.toContain('onHighlightApply')
    expect(source).not.toContain('onHighlightRemove')
    expect(source).not.toContain('onCopy=')
    expect(source).not.toContain('onShare=')
  })
})
