import type { ReactElement } from 'react'

import { YouVersionProvider } from '../web-yv-provider'

// `jest.mock` is hoisted above imports by babel-plugin-jest-hoist regardless of
// source position, so keeping it below the imports satisfies `import/first`
// without changing test semantics.
jest.mock('@youversion/platform-react-ui', () => ({
  YouVersionProvider: 'MockBaseProvider',
}))

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
      'x-yvp-sdk': 'ReactNativeSDK=Dev',
    })
  })

  it('preserves consumer additionalHeaders on non-colliding keys', () => {
    expect(
      renderShim({ additionalHeaders: { 'x-custom': 'ok' } }).additionalHeaders,
    ).toEqual({
      'x-yvp-sdk': 'ReactNativeSDK=Dev',
      'x-custom': 'ok',
    })
  })

  it('SDK header wins over consumer-supplied x-yvp-sdk so attribution stays intact', () => {
    expect(
      renderShim({
        additionalHeaders: { 'x-yvp-sdk': 'hacked', 'x-custom': 'ok' },
      }).additionalHeaders,
    ).toEqual({
      'x-yvp-sdk': 'ReactNativeSDK=Dev',
      'x-custom': 'ok',
    })
  })

})
