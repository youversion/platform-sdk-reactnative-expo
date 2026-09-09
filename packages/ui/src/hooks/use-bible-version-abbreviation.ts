import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useEffect, useState } from 'react'

import { versionMetaFromBody } from '../lib/bible-version-abbreviation'

export type BibleVersionAbbreviation = {
  abbreviation: string | null
  languageId: string | null
}

/** Loads the short version name and language for the toolbar. Falls back to nothing on a miss. */
export function useBibleVersionAbbreviation(
  versionId: number,
  options?: { enabled?: boolean },
): BibleVersionAbbreviation {
  const enabled = options?.enabled ?? true
  const { fetchBibleContent } = useYouVersion()
  const [versionIdForState, setVersionIdForState] = useState(versionId)
  const [abbreviation, setAbbreviation] = useState<string | null>(null)
  const [languageId, setLanguageId] = useState<string | null>(null)

  if (versionIdForState !== versionId) {
    setVersionIdForState(versionId)
    setAbbreviation(null)
    setLanguageId(null)
  }

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false

    void fetchBibleContent({ path: `/v1/bibles/${versionId}` })
      .then((response) => {
        if (cancelled || response.status !== 200) {
          return
        }
        const next = versionMetaFromBody(response.body)
        if (next.abbreviation !== null) {
          setAbbreviation(next.abbreviation)
        }
        if (next.languageId !== null) {
          setLanguageId(next.languageId)
        }
      })
      .catch(() => {
        // Keep the id on the button. A failed lookup is not worth a blank control.
      })

    return () => {
      cancelled = true
    }
  }, [enabled, fetchBibleContent, versionId])

  return { abbreviation, languageId }
}
