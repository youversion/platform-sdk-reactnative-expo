import pkg from '../../../package.json'
import { mergeSdkHeaders } from '../web-yv-provider'

const SDK_HEADER_VALUE = `ReactNativeSDK=${pkg.version}-dev`

describe('mergeSdkHeaders', () => {
  it('injects the x-yvp-sdk header when consumer passes no additionalHeaders', () => {
    expect(mergeSdkHeaders()).toEqual({
      'x-yvp-sdk': SDK_HEADER_VALUE,
    })
  })

  it('preserves consumer additionalHeaders on non-colliding keys', () => {
    expect(mergeSdkHeaders({ 'x-custom': 'ok' })).toEqual({
      'x-yvp-sdk': SDK_HEADER_VALUE,
      'x-custom': 'ok',
    })
  })

  it('SDK header wins over consumer-supplied x-yvp-sdk so attribution stays intact', () => {
    expect(mergeSdkHeaders({ 'x-yvp-sdk': 'hacked', 'x-custom': 'ok' })).toEqual({
      'x-yvp-sdk': SDK_HEADER_VALUE,
      'x-custom': 'ok',
    })
  })
})
