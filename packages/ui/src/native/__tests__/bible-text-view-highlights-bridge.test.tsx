/**
 * Layer 3 — the native → Expo DOM contract for paint-only highlights on
 * BibleTextView.
 *
 * Native owns Cached Highlights and the token. The wrapper subscribes at
 * Highlight Scope and always hands the DOM component a `Highlight[]` so the
 * Web SDK can latch Controlled Highlights Latch. No apply, no remove, no
 * verse-action UI, no token in the WebView.
 */
import { render } from '@testing-library/react-native'
import type { Highlight } from '@youversion/platform-react-native-expo-core'
import * as core from '@youversion/platform-react-native-expo-core'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactNode } from 'react'

import { youVersionProviderWrapper as wrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleTextView } from '../bible-text-view'

type CapturedDomProps = {
  highlights?: unknown
  reference?: string
  versionId?: number
}

/** Every render's props, so "always an array" can be checked, not just "eventually". */
let mockDomPropsHistory: CapturedDomProps[] = []

jest.mock('../../dom/bible-text-view', () => {
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

jest.mock('../../dom/footnote-content', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return { __esModule: true, default: () => <View testID="mock-footnote" /> }
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

const YELLOW = 'fffe00'

function highlight(passageId: string, versionId = 111): Highlight {
  return { version_id: versionId, passage_id: passageId, color: YELLOW }
}

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
})

afterAll(() => {
  useHighlightsSpy.mockRestore()
})

describe('the controlled-mode latch', () => {
  it('hands the DOM component an array on the very first render', () => {
    render(<BibleTextView reference="JHN.3.16" versionId={111} />, { wrapper: wrapper() })

    expect(mockDomPropsHistory.length).toBeGreaterThan(0)
    expect(Array.isArray(mockDomPropsHistory[0]?.highlights)).toBe(true)
  })

  it('never renders with an undefined highlights prop, on any render', () => {
    stubHighlights([highlight('JHN.3.16')])
    render(<BibleTextView reference="JHN.3.16" versionId={111} />, { wrapper: wrapper() })

    expect(mockDomPropsHistory.length).toBeGreaterThan(0)
    for (const props of mockDomPropsHistory) {
      expect(Array.isArray(props.highlights)).toBe(true)
    }
  })

  it('sends no access token across the bridge, on any render', () => {
    stubHighlights([highlight('JHN.3.16')])
    render(<BibleTextView reference="JHN.3.16" versionId={111} />, { wrapper: wrapper() })

    expect(mockDomPropsHistory.length).toBeGreaterThan(0)
    for (const props of mockDomPropsHistory) {
      expect(props).not.toHaveProperty('accessToken')
    }
  })

  it('passes an empty hook result through as [], never undefined', () => {
    render(<BibleTextView reference="JHN.3.16" versionId={111} />, { wrapper: wrapper() })
    expect(lastDomProps().highlights).toEqual([])
  })

  it('forwards the hook’s highlights verbatim, with no adapter in between', () => {
    const data = [highlight('JHN.3.16'), highlight('JHN.3.17-18')]
    stubHighlights(data)

    render(<BibleTextView reference="JHN.3.16" versionId={111} />, { wrapper: wrapper() })

    expect(lastDomProps().highlights).toEqual(data)
  })
})

describe('the highlights subscription scope', () => {
  it('subscribes at Highlight Scope for a verse USFM', () => {
    render(<BibleTextView reference="JHN.3.16" versionId={111} />, { wrapper: wrapper() })

    expect(useHighlightsSpy).toHaveBeenCalledWith({ versionId: 111, book: 'JHN', chapter: '3' })
  })

  it('subscribes at Highlight Scope for a verse-range USFM', () => {
    render(<BibleTextView reference="JHN.1.1-4" versionId={111} />, { wrapper: wrapper() })

    expect(useHighlightsSpy).toHaveBeenCalledWith({ versionId: 111, book: 'JHN', chapter: '1' })
  })

  it('subscribes at Highlight Scope for a chapter USFM', () => {
    render(<BibleTextView reference="JHN.1" versionId={111} />, { wrapper: wrapper() })

    expect(useHighlightsSpy).toHaveBeenCalledWith({ versionId: 111, book: 'JHN', chapter: '1' })
  })

  it('passes [] and does not subscribe when the USFM is invalid', () => {
    render(<BibleTextView reference="not-usfm" versionId={111} />, { wrapper: wrapper() })

    expect(lastDomProps().highlights).toEqual([])
    expect(useHighlightsSpy).not.toHaveBeenCalled()
  })
})

describe('the verse-action event set', () => {
  it('sends no highlight-intent or copy/share handlers across the bridge', () => {
    render(<BibleTextView reference="JHN.3.16" versionId={111} />, { wrapper: wrapper() })

    const props = lastDomProps()
    expect(props).not.toHaveProperty('onHighlightApply')
    expect(props).not.toHaveProperty('onHighlightRemove')
    expect(props).not.toHaveProperty('onCopy')
    expect(props).not.toHaveProperty('onShare')
  })
})

describe('the DOM component source (unobservable from layer 3)', () => {
  const source = readFileSync(join(__dirname, '../../dom/bible-text-view.tsx'), 'utf8')

  it('neither declares nor applies an accessToken prop', () => {
    expect(source).not.toMatch(/^\s*accessToken\b/m)
    expect(source).not.toContain('applyAuthToken')
  })

  it('still clears the residue prior versions left in WebView storage', () => {
    expect(source).toMatch(/^\s*clearAuthResidue\(\)$/m)
  })
})
