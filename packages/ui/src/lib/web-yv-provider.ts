import { YouVersionProvider as BaseYouVersionProvider } from '@youversion/platform-react-ui'
import { createElement, type ComponentProps, type ComponentType } from 'react'

import { getSdkHeaders } from './sdk-version'

// `additionalHeaders` ships in the next Web SDK release; widen the prop type
// locally until that publishes.
type BaseProps = ComponentProps<typeof BaseYouVersionProvider>
type ProviderProps = BaseProps & {
  additionalHeaders?: Record<string, string>
}

const TypedProvider = BaseYouVersionProvider as ComponentType<ProviderProps>

// Header set is constant for the life of the bundle, so compute it once.
const SDK_HEADERS = getSdkHeaders()

// DOM-side wrapper for the Web SDK's `YouVersionProvider`. Stamps the
// `x-yvp-sdk` header onto every API call made from inside a DOM component.
// SDK-attribution headers must always reach the data lake intact, so they
// override any consumer-supplied entry on the same key.
export function YouVersionProvider({ additionalHeaders, ...rest }: ProviderProps) {
  return createElement(TypedProvider, {
    ...rest,
    additionalHeaders: { ...additionalHeaders, ...SDK_HEADERS },
  })
}
