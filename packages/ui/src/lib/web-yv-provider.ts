// Import first: installs the Android `localStorage` shim (see dom-local-storage)
// before the Web SDK module below evaluates and any provider renders.
import { ensureDomLocalStorage } from './dom-local-storage'

import { YouVersionProvider as BaseYouVersionProvider } from '@youversion/platform-react-ui'
import { createElement, type ComponentProps } from 'react'

import { getSdkHeaders } from './sdk-version'

ensureDomLocalStorage()

type ProviderProps = ComponentProps<typeof BaseYouVersionProvider>

// Header set is constant for the life of the bundle, so compute it once.
const SDK_HEADERS = getSdkHeaders()

// DOM-side wrapper for the Web SDK's `YouVersionProvider`. Stamps the
// `x-yvp-sdk` header onto every API call made from inside a DOM component.
// SDK-attribution headers must always reach the data lake intact, so they
// override any consumer-supplied entry on the same key.
export function YouVersionProvider({ additionalHeaders, ...rest }: ProviderProps) {
  return createElement(BaseYouVersionProvider, {
    ...rest,
    additionalHeaders: { ...additionalHeaders, ...SDK_HEADERS },
  })
}
