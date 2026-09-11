/**
 * Layer 3 — the native → Expo DOM contract for paint-only highlights on
 * VerseOfTheDay.
 *
 * Native looks up today's passage_id (never in the WebView), parses Highlight
 * Scope from it, and always hands BibleTextView a `Highlight[]` so the
 * Web SDK can latch Controlled Highlights Latch. Until the passage is known,
 * the scripture surface stays unmounted and `useHighlights` is called with
 * `enabled: false`.
 */
import { render } from '@testing-library/react-native'
import type { Highlight, UseHighlightsOptions } from '@youversion/platform-react-native-expo-core'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Platform, Share, View } from 'react-native'

import { emptyHighlights } from '../../test-utils/default-hook-overrides'
import { resetImpls, setImpl } from '../../test-utils/install-test-impls'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { VerseOfTheDay } from '../verse-of-the-day'
import * as votdPassage from '../use-verse-of-the-day-passage-id'
import * as votdShare from '../use-verse-of-the-day-share-source'

type CapturedDomProps = {
  highlights?: unknown
  versionId?: number
  reference?: string
  dayOfYear?: number
}

/** Every render's props, so "always an array" can be checked, not just "eventually". */
let mockDomPropsHistory: CapturedDomProps[] = []

function MockDOM(props: CapturedDomProps) {
  mockDomPropsHistory.push(props)
  return <View testID="mock-dom" />
}

const YELLOW = 'fffe00'

function highlight(passageId: string, versionId = 111): Highlight {
  return { version_id: versionId, passage_id: passageId, color: YELLOW }
}

const useHighlightsMock = jest.fn(emptyHighlights)
const useVerseOfTheDayPassageIdSpy = jest.spyOn(votdPassage, 'useVerseOfTheDayPassageId')
const useVerseOfTheDayShareSourceSpy = jest.spyOn(votdShare, 'useVerseOfTheDayShareSource')

function stubHighlights(highlights: Highlight[]) {
  useHighlightsMock.mockImplementation((options: UseHighlightsOptions) => ({
    ...emptyHighlights(options),
    highlights: options.enabled === false ? [] : highlights,
  }))
}

const wrapper = youVersionProviderWrapper('light', undefined, {
  useHighlights: useHighlightsMock,
})

function lastDomProps(): CapturedDomProps {
  const props = mockDomPropsHistory.at(-1)
  if (props === undefined) {
    throw new Error('The DOM component never rendered.')
  }
  return props
}

beforeEach(() => {
  mockDomPropsHistory = []
  useHighlightsMock.mockClear()
  stubHighlights([])
  setImpl('BibleTextViewDom', MockDOM)
  setImpl('BibleAppLogo', () => <View testID="bible-app-logo" />)
  useVerseOfTheDayPassageIdSpy.mockReturnValue(null)
  useVerseOfTheDayShareSourceSpy.mockReturnValue({
    shareSource: null,
    loadShareSource: () => Promise.resolve(null),
  })
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' })
})

afterEach(() => {
  resetImpls()
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    enumerable: true,
    value: 'ios',
  })
})

afterAll(() => {
  useVerseOfTheDayPassageIdSpy.mockRestore()
  useVerseOfTheDayShareSourceSpy.mockRestore()
})

describe('the Controlled Highlights Latch', () => {
  it('does not mount the scripture surface until the passage_id is known', () => {
    render(<VerseOfTheDay versionId={111} />, { wrapper })

    expect(mockDomPropsHistory).toEqual([])
  })

  it('hands BibleTextView an array on the very first scripture render', () => {
    const data = [highlight('JHN.3.16')]
    useVerseOfTheDayPassageIdSpy.mockReturnValue('JHN.3.16')
    stubHighlights(data)
    render(<VerseOfTheDay versionId={111} />, { wrapper })

    expect(mockDomPropsHistory.length).toBeGreaterThan(0)
    expect(Array.isArray(mockDomPropsHistory[0]?.highlights)).toBe(true)
    expect(mockDomPropsHistory[0]?.highlights).toEqual(data)
  })

  it('never renders with an undefined highlights prop, on any render', () => {
    useVerseOfTheDayPassageIdSpy.mockReturnValue('JHN.3.16')
    stubHighlights([highlight('JHN.3.16')])
    render(<VerseOfTheDay versionId={111} />, { wrapper })

    expect(mockDomPropsHistory.length).toBeGreaterThan(0)
    for (const props of mockDomPropsHistory) {
      expect(Array.isArray(props.highlights)).toBe(true)
    }
  })

  it('sends no access token across the bridge, on any render', () => {
    useVerseOfTheDayPassageIdSpy.mockReturnValue('JHN.3.16')
    stubHighlights([highlight('JHN.3.16')])
    render(<VerseOfTheDay versionId={111} />, { wrapper })

    expect(mockDomPropsHistory.length).toBeGreaterThan(0)
    for (const props of mockDomPropsHistory) {
      expect(props).not.toHaveProperty('accessToken')
    }
  })

  it('passes the looked-up passage as reference so the WebView cannot sample a different day', () => {
    useVerseOfTheDayPassageIdSpy.mockReturnValue('JHN.3.16')
    render(<VerseOfTheDay versionId={111} />, { wrapper })

    expect(mockDomPropsHistory.length).toBeGreaterThan(0)
    for (const props of mockDomPropsHistory) {
      expect(props.reference).toBe('JHN.3.16')
      expect(props).not.toHaveProperty('dayOfYear')
    }
  })

  it('forwards the hook’s highlights verbatim once the passage is known', () => {
    const data = [highlight('JHN.3.16')]
    useVerseOfTheDayPassageIdSpy.mockReturnValue('JHN.3.16')
    stubHighlights(data)

    render(<VerseOfTheDay versionId={111} />, { wrapper })

    expect(lastDomProps().highlights).toEqual(data)
  })
})

describe('the highlights subscription scope', () => {
  it('calls useHighlights with enabled: false until the passage_id is known', () => {
    render(<VerseOfTheDay versionId={111} />, { wrapper })

    expect(mockDomPropsHistory).toEqual([])
    expect(useHighlightsMock).toHaveBeenCalledWith({
      versionId: 1,
      book: '_',
      chapter: '0',
      enabled: false,
    })
  })

  it('does not mount scripture while passage_id is unknown so other-scope rows cannot paint', () => {
    stubHighlights([highlight('JHN.3.16'), highlight('MAT.5.1')])
    render(<VerseOfTheDay versionId={111} />, { wrapper })

    expect(mockDomPropsHistory).toEqual([])
    expect(useHighlightsMock).toHaveBeenCalledWith({
      versionId: 1,
      book: '_',
      chapter: '0',
      enabled: false,
    })
  })

  it('subscribes at Highlight Scope from the passage_id once it is known', () => {
    const { rerender } = render(<VerseOfTheDay versionId={111} />, { wrapper })

    expect(useHighlightsMock).toHaveBeenCalledWith({
      versionId: 1,
      book: '_',
      chapter: '0',
      enabled: false,
    })
    expect(mockDomPropsHistory).toEqual([])

    useVerseOfTheDayPassageIdSpy.mockReturnValue('JHN.1')
    rerender(<VerseOfTheDay versionId={111} />)

    expect(useHighlightsMock).toHaveBeenLastCalledWith({
      versionId: 111,
      book: 'JHN',
      chapter: '1',
      enabled: true,
    })
    expect(lastDomProps().reference).toBe('JHN.1')
  })

  it('passes [] and does not fetch when the passage_id is invalid USFM', () => {
    useVerseOfTheDayPassageIdSpy.mockReturnValue('not-usfm')
    stubHighlights([highlight('JHN.3.16')])
    render(<VerseOfTheDay versionId={111} />, { wrapper })

    expect(lastDomProps().highlights).toEqual([])
    expect(lastDomProps().reference).toBe('not-usfm')
    expect(useHighlightsMock).toHaveBeenCalledWith({
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
    render(<VerseOfTheDay versionId={111} />, { wrapper })

    const props = lastDomProps()
    expect(props).not.toHaveProperty('onHighlightApply')
    expect(props).not.toHaveProperty('onHighlightRemove')
  })
})

describe('the DOM scripture surface (unobservable from layer 3)', () => {
  const votdSource = readFileSync(join(__dirname, '../verse-of-the-day.tsx'), 'utf8')
  const textViewSource = readFileSync(join(__dirname, '../../dom/bible-text-view.tsx'), 'utf8')
  const legacyDomSource = readFileSync(join(__dirname, '../../dom/verse-of-the-day.tsx'), 'utf8')

  it('embeds BibleTextView instead of the full-component VOTD wrapper', () => {
    expect(votdSource).toContain("getImpl('BibleTextViewDom')")
    expect(votdSource).not.toContain("getImpl('VerseOfTheDayDom')")
  })

  it('keeps the unused full-component DOM wrapper for RNV2-10', () => {
    expect(legacyDomSource).toContain('VerseOfTheDay')
    expect(legacyDomSource).not.toMatch(/^\s*accessToken\b/m)
    expect(legacyDomSource).toMatch(/^\s*clearAuthResidue\(\)$/m)
  })

  it('keeps content fetches on the native Bible Content Client', () => {
    expect(textViewSource).toContain('registerBibleContentAction')
    expect(textViewSource).toContain('fetchBibleContent')
    expect(textViewSource).not.toMatch(/BibleClient/)
  })
})
