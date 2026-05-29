import { renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { useYouVersion } from '../use-youversion'
import { YouVersionContext, type YouVersionContextValue } from '../youversion-context'

describe('useYouVersion', () => {
  it('throws when used outside YouVersionProvider', () => {
    expect(() => renderHook(() => useYouVersion())).toThrow(
      /useYouVersion must be used inside of YouVersionProvider/,
    )
  })

  it('returns the context value when wrapped in YouVersionContext.Provider', () => {
    const value: YouVersionContextValue = {
      appKey: 'appkey',
      apiHost: 'api.example.com',
      installationId: 'inst-1',
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <YouVersionContext.Provider value={value}>{children}</YouVersionContext.Provider>
    )
    const { result } = renderHook(() => useYouVersion(), { wrapper })
    expect(result.current).toBe(value)
  })
})
