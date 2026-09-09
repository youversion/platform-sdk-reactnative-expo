import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useEffect, useState } from 'react'

import { titleFromBooksCatalog, titlesFromBooksBody } from '../lib/bible-book-title'

/** Loads the version's book list once, then looks up the selected book's name. */
export function useBibleBookTitle(versionId: number, book: string): string | null {
  const { fetchBibleContent } = useYouVersion()
  const [titles, setTitles] = useState<ReadonlyMap<string, string> | null>(null)

  useEffect(() => {
    let cancelled = false

    void fetchBibleContent({ path: `/v1/bibles/${versionId}/books` })
      .then((response) => {
        if (cancelled || response.status !== 200) {
          return
        }
        const next = titlesFromBooksBody(response.body)
        if (next !== null) {
          setTitles(next)
        }
      })
      .catch(() => {
        // Keep the last catalog. A failed lookup is not worth a blank control.
      })

    return () => {
      cancelled = true
    }
  }, [fetchBibleContent, versionId])

  return titleFromBooksCatalog(titles, book)
}
