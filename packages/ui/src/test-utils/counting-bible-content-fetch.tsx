import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useMemo, type ComponentType, type ReactNode } from 'react'

import { YouVersionContext } from '../../../core/src/youversion-context'
import { youVersionProviderWrapper } from './youversion-provider-wrapper'

type CountingBibleContentFetch = {
  Wrapper: ComponentType<{ children: ReactNode }>
  contentFetchCount: { current: number }
  returnStale: { current: boolean }
}

export function countingBibleContentFetchWrapper(staleBody: string): CountingBibleContentFetch {
  const contentFetchCount = { current: 0 }
  const returnStale = { current: false }
  const Provider = youVersionProviderWrapper()

  function CountingFetchWrapper({ children }: { children: ReactNode }) {
    const ctx = useYouVersion()
    const innerFetch = ctx.fetchBibleContent
    const fetchBibleContent = useMemo(
      () => async (request: { path: string }) => {
        contentFetchCount.current += 1
        if (returnStale.current) {
          return { status: 200, body: staleBody, contentType: 'application/json' }
        }
        return innerFetch(request)
      },
      [innerFetch],
    )
    const value = useMemo(() => ({ ...ctx, fetchBibleContent }), [ctx, fetchBibleContent])
    return <YouVersionContext.Provider value={value}>{children}</YouVersionContext.Provider>
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider>
        <CountingFetchWrapper>{children}</CountingFetchWrapper>
      </Provider>
    )
  }

  return { Wrapper, contentFetchCount, returnStale }
}
