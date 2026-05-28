import { renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from '../auth-context'
import { useYVAuth } from '../use-yv-auth'

describe('useYVAuth', () => {
  it('throws when used outside a provider with the auth prop set', () => {
    expect(() => renderHook(() => useYVAuth())).toThrow(
      /useYVAuth must be used within YouVersionProvider/,
    )
  })

  it('returns the context value when wrapped in AuthContext.Provider', () => {
    const value: AuthContextValue = {
      isAuthenticated: true,
      accessToken: 'a',
      userInfo: { id: 'u1' },
      error: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshNow: jest.fn(),
      isLoading: false,
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    )
    const { result } = renderHook(() => useYVAuth(), { wrapper })
    expect(result.current).toBe(value)
  })
})
