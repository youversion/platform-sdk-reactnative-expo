import { SDK_VERSION, getSdkHeaders } from '../sdk-version'

describe('sdk-version', () => {
  it('defaults SDK_VERSION to "Dev" for non-release builds', () => {
    expect(SDK_VERSION).toBe('Dev')
  })

  it('returns the x-yvp-sdk header in ReactNativeSDK=Dev form', () => {
    expect(getSdkHeaders()).toEqual({ 'x-yvp-sdk': 'ReactNativeSDK=Dev' })
  })
})
