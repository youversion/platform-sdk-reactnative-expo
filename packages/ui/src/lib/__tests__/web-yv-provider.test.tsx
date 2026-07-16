import type { ReactElement } from 'react'

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

type RenderedProps = { additionalHeaders?: Record<string, string> }

function renderShim(props: Record<string, unknown>): RenderedProps {
  const element = YouVersionProvider({
    appKey: 'test-key',
    children: null,
    ...props,
  } as Parameters<typeof YouVersionProvider>[0]) as ReactElement<RenderedProps>
  return element.props
}

describe('web YouVersionProvider', () => {
  it('injects the x-yvp-sdk header when consumer passes no additionalHeaders', () => {
    expect(renderShim({}).additionalHeaders).toEqual({
      'x-yvp-sdk': SDK_HEADER_VALUE,
    })
  })

  it('preserves consumer additionalHeaders on non-colliding keys', () => {
    expect(renderShim({ additionalHeaders: { 'x-custom': 'ok' } }).additionalHeaders).toEqual({
      'x-yvp-sdk': SDK_HEADER_VALUE,
      'x-custom': 'ok',
    })
  })

  it('SDK header wins over consumer-supplied x-yvp-sdk so attribution stays intact', () => {
    expect(
      renderShim({
        additionalHeaders: { 'x-yvp-sdk': 'hacked', 'x-custom': 'ok' },
      }).additionalHeaders,
    ).toEqual({
      'x-yvp-sdk': SDK_HEADER_VALUE,
      'x-custom': 'ok',
    })
  })
})
