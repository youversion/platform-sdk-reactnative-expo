import { useMemo } from 'react'

import { useYouVersion } from '../use-youversion'
import { createSearchApi, type SearchApi } from './api'

export type UseSearchResult = SearchApi

export function useSearch(): UseSearchResult {
  const { appKey, apiHost, installationId, hookOverrides } = useYouVersion()
  const override = hookOverrides?.useSearch
  const api = useMemo(
    () => createSearchApi({ appKey, apiHost, installationId }),
    [appKey, apiHost, installationId],
  )
  return override?.() ?? api
}
