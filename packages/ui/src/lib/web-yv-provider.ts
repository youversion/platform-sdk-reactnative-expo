// Import first: installs the Android `localStorage` shim (see dom-local-storage)
// before the Web SDK module below evaluates and any provider renders.
import { ensureDomLocalStorage } from './dom-local-storage'

import { YouVersionProvider as BaseYouVersionProvider } from '@youversion/platform-react-ui'
import { createElement, type ComponentProps, type ReactElement } from 'react'

import { mergeSdkHeaders } from './sdk-version'

ensureDomLocalStorage()

type ProviderProps = ComponentProps<typeof BaseYouVersionProvider>

// DOM-side wrapper for the Web SDK's `YouVersionProvider`. Stamps the
// `x-yvp-sdk` header onto every API call made from inside a DOM component.
// SDK-attribution headers must always reach the data lake intact, so they
// override any consumer-supplied entry on the same key.
export function YouVersionProvider({ additionalHeaders, ...rest }: ProviderProps): ReactElement {
  return createElement(BaseYouVersionProvider, {
    ...rest,
    additionalHeaders: mergeSdkHeaders(additionalHeaders),
  })
}
