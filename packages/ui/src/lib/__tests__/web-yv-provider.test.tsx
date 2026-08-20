import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type ReactElement } from 'react'

import pkg from '../../../package.json'
import { YouVersionProvider } from '../web-yv-provider'

// `jest.mock` is hoisted above imports by babel-plugin-jest-hoist regardless of
// source position, so keeping it below the imports satisfies `import/first`
// without changing test semantics.
jest.mock('@youversion/platform-react-ui', () => ({
  YouVersionProvider: 'MockBaseProvider',
}))

// Tests run from source, so the build-channel flag is unstamped and the value
// carries the `-dev` suffix. Derived, not hardcoded: a version bump must not
// break these.
const SDK_HEADER_VALUE = `ReactNativeSDK=${pkg.version}-dev`

type RenderedProps = {
  additionalHeaders?: Record<string, string>
  locale?: string
  permittedVersionIds?: number[]
  excludedVersionIds?: number[]
  permittedLanguageTags?: string[]
}

function renderShim(props: Record<string, unknown>): RenderedProps {
  const element = YouVersionProvider({
    appKey: 'test-key',
    children: null,
    ...props,
  } as Parameters<typeof YouVersionProvider>[0]) as ReactElement<RenderedProps>
  return element.props
}

const VERSION_FILTER_DOM_ENTRIES = [
  'bible-card.tsx',
  'bible-reader.tsx',
  'bible-text-view.tsx',
  'verse-of-the-day.tsx',
  'bible-version-picker-content.tsx',
  'chapter-picker-content.tsx',
] as const

const DOM_ENTRIES = [
  ...VERSION_FILTER_DOM_ENTRIES,
  'bible-reader-settings.tsx',
  'footnote-content.tsx',
] as const

describe('web YouVersionProvider', () => {
  it('injects the x-yvp-sdk header when consumer passes no additionalHeaders', () => {
    expect(renderShim({}).additionalHeaders).toEqual({
      'X-YVP-Sdk': SDK_HEADER_VALUE,
    })
  })

  it('preserves consumer additionalHeaders on non-colliding keys', () => {
    expect(renderShim({ additionalHeaders: { 'x-custom': 'ok' } }).additionalHeaders).toEqual({
      'X-YVP-Sdk': SDK_HEADER_VALUE,
      'x-custom': 'ok',
    })
  })

  it('SDK header wins over consumer-supplied x-yvp-sdk so attribution stays intact', () => {
    expect(
      renderShim({
        additionalHeaders: { 'x-yvp-sdk': 'hacked', 'x-custom': 'ok' },
      }).additionalHeaders,
    ).toEqual({
      'X-YVP-Sdk': SDK_HEADER_VALUE,
      'x-custom': 'ok',
    })
  })

  it('forwards version filter lists to the web YouVersionProvider', () => {
    expect(
      renderShim({
        permittedVersionIds: [111, 206],
        excludedVersionIds: [3034],
        permittedLanguageTags: ['en', 'zh-Hans'],
      }),
    ).toEqual(
      expect.objectContaining({
        permittedVersionIds: [111, 206],
        excludedVersionIds: [3034],
        permittedLanguageTags: ['en', 'zh-Hans'],
      }),
    )
  })

  it('forwards locale to the web YouVersionProvider', () => {
    expect(renderShim({ locale: 'es' })).toEqual(expect.objectContaining({ locale: 'es' }))
  })

  it('forwards empty version filter arrays without coercing to undefined', () => {
    const props = renderShim({
      permittedVersionIds: [],
      excludedVersionIds: [],
      permittedLanguageTags: [],
    })
    expect(props.permittedVersionIds).toEqual([])
    expect(props.excludedVersionIds).toEqual([])
    expect(props.permittedLanguageTags).toEqual([])
  })

  // Layer-3 mocks replace every `'use dom'` entry, so nothing observes whether
  // those files pass filter lists into web YouVersionProvider. Source asserts
  // (same pattern as bible-reader-highlights-bridge) close that seam.
  it.each(VERSION_FILTER_DOM_ENTRIES)(
    '%s source forwards version filter lists onto web YouVersionProvider',
    (filename) => {
      const source = readFileSync(join(__dirname, '../../dom', filename), 'utf8')
      expect(source).toMatch(/^\s*permittedVersionIds=\{permittedVersionIds\}$/m)
      expect(source).toMatch(/^\s*excludedVersionIds=\{excludedVersionIds\}$/m)
      expect(source).toMatch(/^\s*permittedLanguageTags=\{permittedLanguageTags\}$/m)
    },
  )

  it.each(DOM_ENTRIES)('%s source forwards locale onto web YouVersionProvider', (filename) => {
    const source = readFileSync(join(__dirname, '../../dom', filename), 'utf8')
    expect(source).toMatch(/locale=\{locale\}/)
  })
})
