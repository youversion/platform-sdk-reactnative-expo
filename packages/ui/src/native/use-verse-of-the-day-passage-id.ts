import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useEffect, useState } from 'react'

import { getVerseOfTheDayPassageId } from './verse-of-the-day-api'

/**
 * Today's VOTD `passage_id` from the local calendar, or `null` while loading
 * and on failure. Native paint-only surfaces parse chapter from this and
 * subscribe at Highlight Scope — the WebView never does this lookup.
 *
 * Internal. Not on the UI or core package barrel.
 */
export function useVerseOfTheDayPassageId(): string | null {
  const { appKey, apiHost, installationId } = useYouVersion()
  const [passageId, setPassageId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void getVerseOfTheDayPassageId({ appKey, apiHost, installationId }).then((id) => {
      if (!cancelled) {
        setPassageId(id)
      }
    })

    return () => {
      cancelled = true
    }
  }, [appKey, apiHost, installationId])

  return passageId
}
