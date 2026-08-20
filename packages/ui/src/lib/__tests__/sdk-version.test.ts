import pkg from '../../../package.json'
import { SDK_VERSION, getSdkHeaders, mergeSdkHeaders } from '../sdk-version'

describe('sdk-version', () => {
  it('suffixes SDK_VERSION with -dev for non-published builds', () => {
    expect(SDK_VERSION).toBe(`${pkg.version}-dev`)
  })

  it('keeps the version line in dev traffic so telemetry can filter on endsWith("-dev")', () => {
    expect(SDK_VERSION.endsWith('-dev')).toBe(true)
    expect(SDK_VERSION.replace(/-dev$/, '')).toBe(pkg.version)
  })

  it('returns the x-yvp-sdk header in ReactNativeSDK={version}-dev form', () => {
    expect(getSdkHeaders()).toEqual({ 'X-YVP-Sdk': `ReactNativeSDK=${pkg.version}-dev` })
  })

  it('drops consumer x-yvp-sdk keys so Headers cannot combine them with the SDK stamp', () => {
    expect(
      mergeSdkHeaders({
        'x-yvp-sdk': 'hacked',
        'X-YVP-Sdk': 'also-hacked',
        'x-custom': 'ok',
      }),
    ).toEqual({
      'x-custom': 'ok',
      'X-YVP-Sdk': `ReactNativeSDK=${pkg.version}-dev`,
    })
  })
})
