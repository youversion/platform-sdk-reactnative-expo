import {
  parseChapterScopeFromUsfm,
  type FetchBibleContent,
} from '@youversion/platform-react-native-expo-core'
import type { FootnoteData } from '@youversion/platform-react-ui'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { parsePassage, type ParsedPassage } from './parse-passage'

/**
 * Where a passage lives. `usfm` is the API path segment; `book` and `chapter`
 * scope highlights. Build one with `chapterRef` or `passageRefFor`.
 */
export type PassageRef = {
  /** `JHN.3`, `JHN.3.16`, or `JHN.3.16-18`. */
  usfm: string
  book: string
  chapter: string
}

/** A whole chapter, by any chapter id the catalog uses, intros included. */
export function chapterRef(book: string, chapter: string): PassageRef {
  return { usfm: `${book}.${chapter}`, book, chapter }
}

/**
 * A consumer USFM (chapter, verse, or range), read by the same core rule that
 * scopes highlights. `null` when core cannot find a book and chapter in it.
 */
export function passageRefFor(usfm: string): PassageRef | null {
  const scope = parseChapterScopeFromUsfm(usfm)
  return scope === null ? null : { usfm, book: scope.book, chapter: scope.chapter }
}

export type LoadedPassage = PassageRef & {
  /** `${versionId}:${usfm}`; compare before trusting the content. */
  key: string
  versionId: number
  parsed: ParsedPassage
  /** Human reference from the API, e.g. "John 3" or "John 3:16". */
  reference: string
}

export type PassageError = 'offline' | 'unavailable' | 'failed'

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

export function passageKey(versionId: number, ref: PassageRef): string {
  return `${versionId}:${ref.usfm}`
}

/** Fetches through the native content cache and parses off the same tick; a `null` ref skips the request. */
export function usePassage(
  fetchBibleContent: FetchBibleContent,
  versionId: number,
  address: PassageRef | null,
): PassageLoad {
  const [passage, setPassage] = useState<LoadedPassage | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<PassageError | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Strings, so an address rebuilt each render does not refetch.
  const usfm = address?.usfm ?? null
  const book = address?.book ?? ''
  const chapter = address?.chapter ?? ''

  useEffect(() => {
    if (usfm === null) {
      setPending(null)
      return
    }
    let cancelled = false
    const requested: PassageRef = { usfm, book, chapter }
    const key = passageKey(versionId, requested)
    setPending(key)
    setError(null)
    const path = `/v1/bibles/${versionId}/passages/${usfm}?format=html&include_headings=true&include_notes=true`
    fetchBibleContent({ path })
      .then((response) => {
        if (cancelled) {
          return
        }
        // Only 403/404 mean the version lacks this passage; rate limits, 5xx, and
        // bad bodies are transient, so they stay retryable instead of reading as missing.
        if (response.status === 403 || response.status === 404) {
          setError('unavailable')
          return
        }
        const body = response.status === 200 ? parseBody(passageBodySchema, response.body) : null
        if (body === null) {
          setError('failed')
          return
        }
        // Parse here, not in the chain: a throw on bad markup is a content failure, not offline.
        let parsed: ParsedPassage
        try {
          parsed = parsePassage(body.content)
        } catch {
          setError('failed')
          return
        }
        setPassage({
          ...requested,
          key,
          versionId,
          parsed,
          reference: body.reference ?? fallbackReference(requested),
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
  }, [attempt, usfm, book, chapter, fetchBibleContent, versionId])

  return {
    passage,
    loading: pending !== null,
    error,
    retry: () => setAttempt((n) => n + 1),
  }
}

/** `JHN 3` for a chapter, `JHN 3:16` for a verse, when the API sends no reference. */
function fallbackReference({ usfm, book }: PassageRef): string {
  return `${book} ${usfm.slice(book.length + 1).replace('.', ':')}`
}

/** The footnote sheet payload for a tapped note. `verse` null is a note outside any verse. */
export function footnoteFor(
  passage: LoadedPassage | null,
  verse: number | null,
  html: string,
): FootnoteData {
  const info = verse === null ? undefined : passage?.parsed.verses.get(verse)
  return {
    verseNum: verse === null ? '' : String(verse),
    notes: info?.notes ?? [html],
    verseHtml: info?.html ?? '',
    reference: passage?.reference,
  }
}

export type PassageMessageKey =
  | 'offlineConnectionLostMessage'
  | 'passageUnavailable'
  | 'generic.requestErrorBody'

/** One message per failure. A version lookup error (`offline` or `failed`) maps the same way. */
export function passageErrorKey(error: PassageError): PassageMessageKey {
  switch (error) {
    case 'offline':
      return 'offlineConnectionLostMessage'
    case 'unavailable':
      return 'passageUnavailable'
    case 'failed':
      return 'generic.requestErrorBody'
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
