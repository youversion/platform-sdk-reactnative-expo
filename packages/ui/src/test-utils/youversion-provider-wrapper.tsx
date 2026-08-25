import type { HookOverrides } from '@youversion/platform-react-native-expo-core'
import type { ComponentType, ReactNode } from 'react'

import { YouVersionProvider } from '../native/youversion-provider'
import { defaultHookOverrides } from './default-hook-overrides'

/** RTL `wrapper` factory shared by native component tests that need `YouVersionProvider`. */
export function youVersionProviderWrapper(
  providerTheme: 'light' | 'dark' | 'system' = 'light',
  locale?: string,
  hookOverrides?: HookOverrides,
): ComponentType<{ children: ReactNode }> {
  function YouVersionTestWrapper({ children }: { children: ReactNode }) {
    return (
      <YouVersionProvider
        appKey="test-key"
        theme={providerTheme}
        locale={locale}
        hookOverrides={{ ...defaultHookOverrides, ...hookOverrides }}
      >
        {children}
      </YouVersionProvider>
    )
  }
  return YouVersionTestWrapper
}
