/**
 * Pins core's package export maps and the `./api-client` subpath. Greptile's
 * public-api-pin rule allows that subpath only when a core exports test pins it
 * (ADR 0011). The barrel must stay free of the factory and the host constant.
 */
import pkg from '../../package.json'
import * as apiClient from '../api-client'
import * as core from '../index'

describe('core package exports', () => {
  it('pins the source and publish export maps', () => {
    expect(pkg.exports).toEqual({
      '.': {
        types: './src/index.ts',
        default: './src/index.ts',
      },
      './sdk-version': {
        types: './src/sdk-version.ts',
        default: './src/sdk-version.ts',
      },
      './api-client': {
        types: './src/api-client.ts',
        default: './src/api-client.ts',
      },
      './package.json': './package.json',
    })
    expect(pkg.publishConfig.exports).toEqual({
      '.': {
        types: './build/index.d.ts',
        default: './build/index.js',
      },
      './sdk-version': {
        types: './build/sdk-version.d.ts',
        default: './build/sdk-version.js',
      },
      './api-client': {
        types: './build/api-client.d.ts',
        default: './build/api-client.js',
      },
      './package.json': './package.json',
    })
  })

  it('exposes createApiClient and DEFAULT_API_HOST on the api-client subpath only', () => {
    expect(apiClient.createApiClient).toEqual(expect.any(Function))
    expect(apiClient.DEFAULT_API_HOST).toBe('api.youversion.com')

    const names = Object.keys(core)
    expect(names).not.toContain('createApiClient')
    expect(names).not.toContain('DEFAULT_API_HOST')
    expect(names).not.toContain('ApiClient')
  })
})
