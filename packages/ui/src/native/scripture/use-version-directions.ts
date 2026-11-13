import type { FetchBibleContent } from '@youversion/platform-react-native-expo-core'
import { useEffect, useState } from 'react'
import { z } from 'zod'

export type TextDirection = 'ltr' | 'rtl'

export type VersionDirections = ReadonlyMap<number, TextDirection>

const NO_DIRECTIONS: VersionDirections = new Map()

const versionIndexSchema = z.object({
  text_direction: z.enum(['ltr', 'rtl']),
})

/**
 * Each loaded version's `text_direction`. Keyed by version so the dimmed old chapter keeps its own
 * direction while the next version loads. A version with no entry falls back to the letter vote.
 */
export function useVersionDirections(
  fetchBibleContent: FetchBibleContent,
  versionId: number,
): VersionDirections {
  const [directions, setDirections] = useState(NO_DIRECTIONS)
  const known = directions.has(versionId)

  useEffect(() => {
    if (known) {
      return
    }
    fetchBibleContent({ path: `/v1/bibles/${versionId}/index` })
      .then((response) => {
        const body = response.status === 200 ? parseBody(versionIndexSchema, response.body) : null
        if (body !== null) {
          setDirections((current) => new Map(current).set(versionId, body.text_direction))
        }
      })
      .catch(() => {
        // The letter vote covers a miss; the passage request reports connectivity.
      })
  }, [fetchBibleContent, known, versionId])

  return directions
}

function parseBody<T>(schema: z.ZodType<T>, body: string): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(body))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
