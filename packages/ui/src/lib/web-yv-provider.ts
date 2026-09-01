// Import first: installs the Android `localStorage` shim (see dom-local-storage)
// before the Web SDK module below evaluates and any provider renders.
import { ensureDomLocalStorage } from './dom-local-storage'

import { YouVersionProvider as BaseYouVersionProvider } from '@youversion/platform-react-ui'
import { createElement, type ComponentProps, type ReactNode } from 'react'

import { ensureDomContentCache } from './dom-content-cache'
import { mergeSdkHeaders } from './sdk-version'

ensureDomLocalStorage()
ensureDomContentCache()

type ProviderProps = ComponentProps<typeof BaseYouVersionProvider>

export function YouVersionProvider({ additionalHeaders, ...rest }: ProviderProps): ReactNode {
  return createElement(BaseYouVersionProvider, {
    ...rest,
    additionalHeaders: mergeSdkHeaders(additionalHeaders),
  })
}
