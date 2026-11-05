import { useMemo } from 'react'

import { useYouVersion } from '../use-youversion'
import { createVerseOfTheDayApi, type VerseOfTheDayApi } from './api'

export type UseVerseOfTheDayResult = VerseOfTheDayApi

export function useVerseOfTheDay(): UseVerseOfTheDayResult {
  const { appKey, apiHost, installationId, hookOverrides } = useYouVersion()
  const override = hookOverrides?.useVerseOfTheDay
  const api = useMemo(
    () => createVerseOfTheDayApi({ appKey, apiHost, installationId }),
    [appKey, apiHost, installationId],
  )
  return override?.() ?? api
}
