import { renderHook } from '@testing-library/react-native'
import * as ReactNative from 'react-native'

import type { YouVersionTheme } from '../../native/youversion-provider'
import { youVersionProviderWrapper as wrapper } from '../../test-utils/youversion-provider-wrapper'
import { getTokens } from '../../theme'
import { useTokens } from '../use-tokens'

describe('useTokens', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns light tokens when the provider theme is light', () => {
    const { result } = renderHook(() => useTokens(), { wrapper: wrapper('light') })

    expect(result.current).toBe(getTokens('light'))
  })

  it('returns dark tokens when the provider theme is dark', () => {
    const { result } = renderHook(() => useTokens(), { wrapper: wrapper('dark') })

    expect(result.current).toBe(getTokens('dark'))
  })

  it('follows the device scheme when the provider theme is system', () => {
    const spy = jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark')

    try {
      const { result } = renderHook(() => useTokens(), { wrapper: wrapper('system') })

      expect(result.current).toBe(getTokens('dark'))
    } finally {
      spy.mockRestore()
    }
  })

  it('updates tokens when the provider theme changes', () => {
    let theme: YouVersionTheme = 'light'
    const { result, rerender } = renderHook(() => useTokens(), { wrapper: wrapper(() => theme) })

    expect(result.current).toBe(getTokens('light'))

    theme = 'dark'
    rerender(undefined)

    expect(result.current).toBe(getTokens('dark'))
  })

  it('falls back to light tokens outside a provider', () => {
    const { result } = renderHook(() => useTokens())

    expect(result.current).toBe(getTokens('light'))
  })
})
