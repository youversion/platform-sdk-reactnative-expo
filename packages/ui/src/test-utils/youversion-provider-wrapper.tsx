import type { HookOverrides } from '@youversion/platform-react-native-expo-core'
import type { ComponentType, ReactNode } from 'react'

import { YouVersionProvider, type YouVersionTheme } from '../native/youversion-provider'
import { defaultHookOverrides } from './default-hook-overrides'

type YouVersionTestWrapper = ComponentType<{ children: ReactNode }> & {
  setTheme: (theme: YouVersionTheme) => void
}

/** RTL `wrapper` factory shared by native component tests that need `YouVersionProvider`. */
export function youVersionProviderWrapper(
  providerTheme: YouVersionTheme = 'light',
  locale?: string,
  hookOverrides?: HookOverrides,
): YouVersionTestWrapper {
  const themeHolder = { current: providerTheme }

  function YouVersionTestWrapper({ children }: { children: ReactNode }) {
    return (
      <YouVersionProvider
        appKey="test-key"
        theme={themeHolder.current}
        locale={locale}
        hookOverrides={{ ...defaultHookOverrides, ...hookOverrides }}
      >
        {children}
      </YouVersionProvider>
    )
  }

  function setTheme(theme: YouVersionTheme) {
    themeHolder.current = theme
  }

  return Object.assign(YouVersionTestWrapper, { setTheme })
}
