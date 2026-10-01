import type { FetchBibleContent } from '@youversion/platform-react-native-expo-core'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { parsePassage, type ParsedPassage } from './parse-passage'

export type LoadedPassage = {
  /** `${versionId}:${book}.${chapter}`; compare before trusting the content. */
  key: string
  versionId: number
  book: string
  chapter: string
  parsed: ParsedPassage
  /** Human chapter reference from the API, e.g. "John 3". */
  reference: string
}

export type PassageError = 'offline' | 'unavailable'

export type PassageLoad = {
  /** The last passage that loaded; it stays up, dimmed, while the next one loads. */
  passage: LoadedPassage | null
  loading: boolean
  error: PassageError | null
  retry: () => void
}

const passageBodySchema = z.object({
  content: z.string(),
  reference: z.string().optional(),
})

const versionBodySchema = z.object({
  copyright: z.string().nullish(),
  publisher_url: z.string().nullish(),
})

export function passageKey(versionId: number, book: string, chapter: string): string {
  return `${versionId}:${book}.${chapter}`
}

/** Fetches through the native content cache and parses off the same tick; `enabled` false skips the request. */
export function usePassage(
  fetchBibleContent: FetchBibleContent,
  versionId: number,
  book: string,
  chapter: string,
  enabled: boolean,
): PassageLoad {
  const [passage, setPassage] = useState<LoadedPassage | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<PassageError | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setPending(null)
      return
    }
    let cancelled = false
    const key = passageKey(versionId, book, chapter)
    setPending(key)
    setError(null)
    const path = `/v1/bibles/${versionId}/passages/${book}.${chapter}?format=html&include_headings=true&include_notes=true`
    fetchBibleContent({ path })
      .then((response) => {
        if (cancelled) {
          return
        }
        const body = response.status === 200 ? parseBody(passageBodySchema, response.body) : null
        if (body === null) {
          setError('unavailable')
          return
        }
        setPassage({
          key,
          versionId,
          book,
          chapter,
          parsed: parsePassage(body.content),
          reference: body.reference ?? `${book} ${chapter}`,
        })
      })
      .catch(() => {
        if (!cancelled) {
          setError('offline')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPending(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [attempt, book, chapter, enabled, fetchBibleContent, versionId])

  return {
    passage,
    loading: pending !== null,
    error,
    retry: () => setAttempt((n) => n + 1),
  }
}

export type VersionCopyright = {
  copyright: string | null
  publisherUrl: string | null
}

const NO_COPYRIGHT: VersionCopyright = { copyright: null, publisherUrl: null }

/** Copyright line and publisher link for the footer; a miss just hides the footer. */
export function useVersionCopyright(
  fetchBibleContent: FetchBibleContent,
  versionId: number,
): VersionCopyright {
  const [owned, setOwned] = useState<{ versionId: number; value: VersionCopyright } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchBibleContent({ path: `/v1/bibles/${versionId}` })
      .then((response) => {
        const body = response.status === 200 ? parseBody(versionBodySchema, response.body) : null
        if (cancelled || body === null) {
          return
        }
        setOwned({
          versionId,
          value: {
            copyright: body.copyright?.trim() || null,
            publisherUrl: body.publisher_url?.trim() || null,
          },
        })
      })
      .catch(() => {
        // The footer is optional; the passage request reports connectivity.
      })
    return () => {
      cancelled = true
    }
  }, [fetchBibleContent, versionId])

  return owned !== null && owned.versionId === versionId ? owned.value : NO_COPYRIGHT
}

function parseBody<T>(schema: z.ZodType<T>, body: string): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(body))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
