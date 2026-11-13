import type { FetchBibleContent } from '@youversion/platform-react-native-expo-core'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { parseBody } from './use-passage'

export type TextDirection = 'ltr' | 'rtl'

export type VersionDirections = ReadonlyMap<number, TextDirection>

const NO_DIRECTIONS: VersionDirections = new Map()

const versionIndexSchema = z.object({
  text_direction: z.enum(['ltr', 'rtl']),
})

const indexDirectionCache = new WeakMap<
  FetchBibleContent,
  Map<number, Promise<TextDirection | null>>
>()

function directionForVersion(
  fetchBibleContent: FetchBibleContent,
  versionId: number,
): Promise<TextDirection | null> {
  let byVersion = indexDirectionCache.get(fetchBibleContent)
  if (byVersion === undefined) {
    byVersion = new Map()
    indexDirectionCache.set(fetchBibleContent, byVersion)
  }
  const cached = byVersion.get(versionId)
  if (cached !== undefined) {
    return cached
  }
  const pending = fetchBibleContent({ path: `/v1/bibles/${versionId}/index` })
    .then((response) => {
      const body = response.status === 200 ? parseBody(versionIndexSchema, response.body) : null
      return body?.text_direction ?? null
    })
    .catch(() => {
      byVersion.delete(versionId)
      throw new Error('index-fetch-failed')
    })
  byVersion.set(versionId, pending)
  return pending
}

export type UseVersionDirectionsOptions = {
  /** When false, skips the index fetch (host direction or direction not needed). Default true. */
  enabled?: boolean
}

/**
 * Each loaded version's `text_direction`. Keyed by version so the dimmed old chapter keeps its own
 * direction while the next version loads. A version with no entry falls back to the letter vote.
 */
export function useVersionDirections(
  fetchBibleContent: FetchBibleContent,
  versionId: number,
  options?: UseVersionDirectionsOptions,
): VersionDirections {
  const enabled = options?.enabled !== false
  const [directions, setDirections] = useState(NO_DIRECTIONS)
  const known = directions.has(versionId)

  useEffect(() => {
    if (!enabled || known) {
      return
    }
    let cancelled = false
    void directionForVersion(fetchBibleContent, versionId)
      .then((direction) => {
        if (cancelled || direction === null) {
          return
        }
        setDirections((current) => new Map(current).set(versionId, direction))
      })
      .catch(() => {
        // The letter vote covers a miss; the passage request reports connectivity.
      })
    return () => {
      cancelled = true
    }
  }, [enabled, fetchBibleContent, known, versionId])

  return directions
}
