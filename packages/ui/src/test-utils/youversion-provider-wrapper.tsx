import type { HookOverrides } from '@youversion/platform-react-native-expo-core'
import type { ComponentType, ReactNode } from 'react'

import { YouVersionProvider, type YouVersionTheme } from '../native/youversion-provider'
import { defaultHookOverrides } from './default-hook-overrides'

type ProviderThemeInput = YouVersionTheme | (() => YouVersionTheme)

/** RTL `wrapper` factory shared by native component tests that need `YouVersionProvider`. */
export function youVersionProviderWrapper(
  providerTheme: ProviderThemeInput = 'light',
  locale?: string,
  hookOverrides?: HookOverrides,
): ComponentType<{ children: ReactNode }> {
  function YouVersionTestWrapper({ children }: { children: ReactNode }) {
    const theme = typeof providerTheme === 'function' ? providerTheme() : providerTheme

    return (
      <YouVersionProvider
        appKey="test-key"
        theme={theme}
        locale={locale}
        hookOverrides={{ ...defaultHookOverrides, ...hookOverrides }}
      >
        {children}
      </YouVersionProvider>
    )
  }
  return YouVersionTestWrapper
}
