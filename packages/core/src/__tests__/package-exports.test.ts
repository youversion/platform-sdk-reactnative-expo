/**
 * Pins core's package export maps and the internal subpaths. Greptile's
 * public-api-pin rule allows those subpaths only when a core exports test pins
 * them (ADR 0011). The barrel must stay free of the factory and the host
 * constant.
 */
import pkg from '../../package.json'
import * as apiClient from '../api-client'
import * as defaultApiHost from '../default-api-host'
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
      './default-api-host': {
        types: './src/default-api-host.ts',
        default: './src/default-api-host.ts',
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
      './default-api-host': {
        types: './build/default-api-host.d.ts',
        default: './build/default-api-host.js',
      },
      './package.json': './package.json',
    })
  })

  it('exposes createApiClient on the api-client subpath only', () => {
    expect(apiClient.createApiClient).toEqual(expect.any(Function))
    expect(Object.keys(apiClient)).not.toContain('DEFAULT_API_HOST')

    const names = Object.keys(core)
    expect(names).not.toContain('createApiClient')
    expect(names).not.toContain('DEFAULT_API_HOST')
    expect(names).not.toContain('ApiClient')
  })

  it('exposes DEFAULT_API_HOST on the default-api-host subpath only', () => {
    expect(defaultApiHost.DEFAULT_API_HOST).toBe('api.youversion.com')
    expect(Object.keys(defaultApiHost)).toEqual(['DEFAULT_API_HOST'])

    const names = Object.keys(core)
    expect(names).not.toContain('DEFAULT_API_HOST')
  })
})
