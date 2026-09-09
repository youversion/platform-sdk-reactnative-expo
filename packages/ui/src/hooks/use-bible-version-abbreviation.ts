import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useEffect, useState } from 'react'

import { abbreviationFromVersionBody } from '../lib/bible-version-abbreviation'

/** Loads the short version name for the toolbar. Falls back to nothing on a miss. */
export function useBibleVersionAbbreviation(versionId: number): string | null {
  const { fetchBibleContent } = useYouVersion()
  const [abbreviation, setAbbreviation] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setAbbreviation(null)

    void fetchBibleContent({ path: `/v1/bibles/${versionId}` })
      .then((response) => {
        if (cancelled || response.status !== 200) {
          return
        }
        const next = abbreviationFromVersionBody(response.body)
        if (next !== null) {
          setAbbreviation(next)
        }
      })
      .catch(() => {
        // Keep the id on the button. A failed lookup is not worth a blank control.
      })

    return () => {
      cancelled = true
    }
  }, [fetchBibleContent, versionId])

  return abbreviation
}
