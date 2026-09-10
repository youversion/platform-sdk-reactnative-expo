import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import type { VerseOfTheDayShareData } from '@youversion/platform-react-ui'
import { useEffect, useState } from 'react'

import { getVerseOfTheDayShareSource } from './verse-of-the-day-share'

type ShareSourceForPassage = {
  passageId: string
  versionId: number
  data: VerseOfTheDayShareData | null
}

/**
 * Share payload for the pinned VOTD passage, or `null` while loading, on
 * failure, and while the resolved passage does not match the requested one.
 *
 * Internal. Not on the UI or core package barrel.
 */
export function useVerseOfTheDayShareSource(
  versionId: number,
  passageId: string | null,
): VerseOfTheDayShareData | null {
  const { fetchBibleContent } = useYouVersion()
  const [result, setResult] = useState<ShareSourceForPassage | null>(null)

  useEffect(() => {
    if (passageId == null) {
      return
    }
    let cancelled = false

    void getVerseOfTheDayShareSource(fetchBibleContent, versionId, passageId).then((data) => {
      if (!cancelled) {
        setResult({ passageId, versionId, data })
      }
    })

    return () => {
      cancelled = true
    }
  }, [fetchBibleContent, versionId, passageId])

  if (result === null || result.passageId !== passageId || result.versionId !== versionId) {
    return null
  }
  return result.data
}
