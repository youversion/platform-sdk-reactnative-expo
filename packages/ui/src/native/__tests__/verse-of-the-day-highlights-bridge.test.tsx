/**
 * Layer 3 — the native → Expo DOM contract for paint-only highlights on
 * VerseOfTheDay.
 *
 * Native looks up today's passage_id (never in the WebView), parses Highlight
 * Scope from it, and always hands the DOM component a `Highlight[]` so the
 * Web SDK can latch Controlled Highlights Latch. Until the passage is known,
 * that array is a Cached Highlights superset (or `[]` when signed out) and
 * `useHighlights` is called with `enabled: false`.
 */
import { render } from '@testing-library/react-native'
import type { Highlight } from '@youversion/platform-react-native-expo-core'
import * as core from '@youversion/platform-react-native-expo-core'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Platform, Share } from 'react-native'

import { youVersionProviderWrapper as wrapper } from '../../test-utils/youversion-provider-wrapper'
import { VerseOfTheDay } from '../verse-of-the-day'
import * as votdPassage from '../use-verse-of-the-day-passage-id'

type CapturedDomProps = {
  highlights?: unknown
  versionId?: number
}

/** Every render's props, so "always an array" can be checked, not just "eventually". */
let mockDomPropsHistory: CapturedDomProps[] = []

jest.mock('../../dom/verse-of-the-day', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: function MockDOM(props: CapturedDomProps) {
      mockDomPropsHistory.push(props)
      return <View testID="mock-dom" />
    },
  }
})

const YELLOW = 'fffe00'

function highlight(passageId: string, versionId = 111): Highlight {
  return { version_id: versionId, passage_id: passageId, color: YELLOW }
}

const useHighlightsSpy = jest.spyOn(core, 'useHighlights')
const useVerseOfTheDayPassageIdSpy = jest.spyOn(votdPassage, 'useVerseOfTheDayPassageId')

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

function lastDomProps(): CapturedDomProps {
  const props = mockDomPropsHistory.at(-1)
  if (props === undefined) {
    throw new Error('The DOM component never rendered.')
  }
  return props
}

beforeEach(() => {
  mockDomPropsHistory = []
  useHighlightsSpy.mockClear()
  stubHighlights([])
  useVerseOfTheDayPassageIdSpy.mockReturnValue(null)
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' })
})

afterEach(() => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    enumerable: true,
    value: 'ios',
  })
})

afterAll(() => {
  useHighlightsSpy.mockRestore()
  useVerseOfTheDayPassageIdSpy.mockRestore()
})

describe('the Controlled Highlights Latch', () => {
  it('hands the DOM component an array on the very first render, including while loading', () => {
    render(<VerseOfTheDay versionId={111} />, { wrapper: wrapper() })

    expect(mockDomPropsHistory.length).toBeGreaterThan(0)
    expect(Array.isArray(mockDomPropsHistory[0]?.highlights)).toBe(true)
    expect(mockDomPropsHistory[0]?.highlights).toEqual([])
  })

  it('hands the DOM component the hook’s cache snapshot on the very first render when passage_id is known', () => {
    const data = [highlight('JHN.3.16')]
    useVerseOfTheDayPassageIdSpy.mockReturnValue('JHN.3.16')
    stubHighlights(data)
    render(<VerseOfTheDay versionId={111} />, { wrapper: wrapper() })

    expect(mockDomPropsHistory.length).toBeGreaterThan(0)
    expect(mockDomPropsHistory[0]?.highlights).toEqual(data)
  })

  it('never renders with an undefined highlights prop, on any render', () => {
    useVerseOfTheDayPassageIdSpy.mockReturnValue('JHN.3.16')
    stubHighlights([highlight('JHN.3.16')])
    render(<VerseOfTheDay versionId={111} />, { wrapper: wrapper() })

    expect(mockDomPropsHistory.length).toBeGreaterThan(0)
    for (const props of mockDomPropsHistory) {
      expect(Array.isArray(props.highlights)).toBe(true)
    }
  })

  it('sends no access token across the bridge, on any render', () => {
    useVerseOfTheDayPassageIdSpy.mockReturnValue('JHN.3.16')
    stubHighlights([highlight('JHN.3.16')])
    render(<VerseOfTheDay versionId={111} />, { wrapper: wrapper() })

    expect(mockDomPropsHistory.length).toBeGreaterThan(0)
    for (const props of mockDomPropsHistory) {
      expect(props).not.toHaveProperty('accessToken')
    }
  })

  it('forwards the hook’s highlights verbatim once the passage is known', () => {
    const data = [highlight('JHN.3.16')]
    useVerseOfTheDayPassageIdSpy.mockReturnValue('JHN.3.16')
    stubHighlights(data)

    render(<VerseOfTheDay versionId={111} />, { wrapper: wrapper() })

    expect(lastDomProps().highlights).toEqual(data)
  })
})

describe('the highlights subscription scope', () => {
  it('calls useHighlights with enabled: false until the passage_id is known', () => {
    render(<VerseOfTheDay versionId={111} />, { wrapper: wrapper() })

    expect(lastDomProps().highlights).toEqual([])
    expect(useHighlightsSpy).toHaveBeenCalledWith({
      versionId: 1,
      book: '_',
      chapter: '0',
      enabled: false,
    })
  })

  it('passes a Cached Highlights superset while passage_id is unknown', () => {
    const data = [highlight('JHN.3.16'), highlight('MAT.5.1')]
    const useHighlightPaintSpy = jest.spyOn(core, 'useHighlightPaint')
    useHighlightPaintSpy.mockImplementation((scope) => {
      const enabled = scope !== null
      let versionId = 1
      let book = '_'
      let chapter = '0'
      if (scope !== null) {
        versionId = scope.versionId
        book = scope.book
        chapter = scope.chapter
      }
      core.useHighlights({ versionId, book, chapter, enabled })
      if (scope !== null) {
        return []
      }
      return data
    })

    try {
      render(<VerseOfTheDay versionId={111} />, { wrapper: wrapper() })

      expect(Array.isArray(mockDomPropsHistory[0]?.highlights)).toBe(true)
      expect(mockDomPropsHistory[0]?.highlights).toEqual(data)
      expect(useHighlightsSpy).toHaveBeenCalledWith({
        versionId: 1,
        book: '_',
        chapter: '0',
        enabled: false,
      })
    } finally {
      useHighlightPaintSpy.mockRestore()
    }
  })

  it('subscribes at Highlight Scope from the passage_id once it is known', () => {
    const { rerender } = render(<VerseOfTheDay versionId={111} />, { wrapper: wrapper() })

    expect(useHighlightsSpy).toHaveBeenCalledWith({
      versionId: 1,
      book: '_',
      chapter: '0',
      enabled: false,
    })
    expect(lastDomProps().highlights).toEqual([])

    useVerseOfTheDayPassageIdSpy.mockReturnValue('JHN.1')
    rerender(<VerseOfTheDay versionId={111} />)

    expect(useHighlightsSpy).toHaveBeenLastCalledWith({
      versionId: 111,
      book: 'JHN',
      chapter: '1',
      enabled: true,
    })
  })

  it('passes a superset (or []) and does not fetch when the passage_id is invalid USFM', () => {
    useVerseOfTheDayPassageIdSpy.mockReturnValue('not-usfm')
    render(<VerseOfTheDay versionId={111} />, { wrapper: wrapper() })

    expect(Array.isArray(lastDomProps().highlights)).toBe(true)
    expect(useHighlightsSpy).toHaveBeenCalledWith({
      versionId: 1,
      book: '_',
      chapter: '0',
      enabled: false,
    })
  })
})

describe('the verse-action event set', () => {
  it('sends no highlight-intent handlers across the bridge', () => {
    useVerseOfTheDayPassageIdSpy.mockReturnValue('JHN.3.16')
    render(<VerseOfTheDay versionId={111} />, { wrapper: wrapper() })

    const props = lastDomProps()
    expect(props).not.toHaveProperty('onHighlightApply')
    expect(props).not.toHaveProperty('onHighlightRemove')
  })
})

describe('the DOM component source (unobservable from layer 3)', () => {
  const source = readFileSync(join(__dirname, '../../dom/verse-of-the-day.tsx'), 'utf8')

  it('neither declares nor applies an accessToken prop', () => {
    expect(source).not.toMatch(/^\s*accessToken\b/m)
    expect(source).not.toContain('applyAuthToken')
  })

  it('still clears the residue prior versions left in WebView storage', () => {
    expect(source).toMatch(/^\s*clearAuthResidue\(\)$/m)
  })
})
