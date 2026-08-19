import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useEffect, useState } from 'react'

import { getVerseOfTheDayPassageId } from './verse-of-the-day-api'

type PassageForDay = {
  dayOfYear: number
  passageId: string | null
}

/**
 * VOTD `passage_id` for a pinned `dayOfYear`, or `null` while loading, on
 * failure, and while the resolved day does not match the requested one.
 * Native paint-only surfaces parse chapter from this and subscribe at
 * Highlight Scope — the WebView never does this lookup.
 *
 * Internal. Not on the UI or core package barrel.
 */
export function useVerseOfTheDayPassageId(dayOfYear: number): string | null {
  const { appKey, apiHost, installationId } = useYouVersion()
  const [result, setResult] = useState<PassageForDay | null>(null)

  useEffect(() => {
    let cancelled = false

    void getVerseOfTheDayPassageId({ appKey, apiHost, installationId }, dayOfYear).then((id) => {
      if (!cancelled) {
        setResult({ dayOfYear, passageId: id })
      }
    })

    return () => {
      cancelled = true
    }
  }, [appKey, apiHost, installationId, dayOfYear])

  if (result === null || result.dayOfYear !== dayOfYear) {
    return null
  }
  return result.passageId
}
