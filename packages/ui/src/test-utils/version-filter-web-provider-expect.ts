import { type ReactElement } from 'react'

import { YouVersionProvider } from '../lib/web-yv-provider'

type DomBridgeProps = {
  appKey?: string
  theme?: string
  permittedVersionIds?: number[]
  excludedVersionIds?: number[]
  permittedLanguageTags?: string[]
}

/** Mirror how DOM wrappers call `web-yv-provider` `YouVersionProvider`. */
export function webProviderPropsFromDomBridge(domProps: DomBridgeProps) {
  const element = YouVersionProvider({
    appKey: domProps.appKey ?? 'test-key',
    theme: domProps.theme ?? 'light',
    children: null,
    permittedVersionIds: domProps.permittedVersionIds,
    excludedVersionIds: domProps.excludedVersionIds,
    permittedLanguageTags: domProps.permittedLanguageTags,
  } as Parameters<typeof YouVersionProvider>[0]) as ReactElement<
    DomBridgeProps & { children: null }
  >
  return element.props
}
