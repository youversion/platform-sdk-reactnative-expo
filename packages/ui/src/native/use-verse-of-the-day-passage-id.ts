import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useCallback, useEffect, useState } from 'react'

import { getVerseOfTheDayPassageId } from './verse-of-the-day-api'

type PassageForDay =
  | { dayOfYear: number; status: 'failed' }
  | { dayOfYear: number; status: 'ready'; passageId: string }

export type VerseOfTheDayPassageLookup =
  | { status: 'loading' | 'failed'; passageId: null; retry: () => void }
  | { status: 'ready'; passageId: string; retry: () => void }

/**
 * VOTD `passage_id` for a pinned `dayOfYear`. `loading` while the request is
 * in flight or the resolved day does not match; `failed` when the lookup
 * returns nothing. Native paint-only surfaces parse chapter from this and
 * subscribe at Highlight Scope — the WebView never does this lookup.
 *
 * Internal. Not on the UI or core package barrel.
 */
export function useVerseOfTheDayPassageId(dayOfYear: number): VerseOfTheDayPassageLookup {
  const { appKey, apiHost, installationId } = useYouVersion()
  const [result, setResult] = useState<PassageForDay | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    void getVerseOfTheDayPassageId({ appKey, apiHost, installationId }, dayOfYear).then((id) => {
      if (cancelled) {
        return
      }
      if (id == null) {
        setResult({ dayOfYear, status: 'failed' })
        return
      }
      setResult({ dayOfYear, status: 'ready', passageId: id })
    })

    return () => {
      cancelled = true
    }
  }, [appKey, apiHost, installationId, dayOfYear, attempt])

  const retry = useCallback(() => {
    setResult(null)
    setAttempt((current) => current + 1)
  }, [])

  if (result === null || result.dayOfYear !== dayOfYear) {
    return { status: 'loading', passageId: null, retry }
  }
  if (result.status === 'failed') {
    return { status: 'failed', passageId: null, retry }
  }
  return { status: 'ready', passageId: result.passageId, retry }
}
