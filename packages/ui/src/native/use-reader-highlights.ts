import type { Highlight, HighlightScope } from '@youversion/platform-react-native-expo-core'
import { useHighlights } from '@youversion/platform-react-native-expo-core'
import { useMemo } from 'react'

export type UseReaderHighlightsOptions = {
  versionId: number
  book: string
  chapter: string
}

export type UseReaderHighlightsResult = {
  /**
   * Always an array — never `undefined`. The Web SDK latches controlled mode on
   * the presence of `highlights` at first mount, so a single `undefined` frame
   * would drop the reader into self-contained mode for the rest of its life.
   */
  highlights: Highlight[]
  /**
   * The scope `highlights` belongs to. Handlers gate incoming intents against
   * it so a tap that races a chapter change cannot write into the new chapter.
   */
  scope: HighlightScope
}

/**
 * The reader's highlights orchestrator — the RN analogue of Swift's
 * `BibleReaderViewModel`. The native wrapper forwards taps and presents sheets;
 * this hook decides.
 *
 * Deliberately thin today: it reads from core's `useHighlights`, which is the
 * only optimistic layer in the stack (ADR 0013). With no `auth` configured on
 * `YouVersionProvider`, or signed out, that hook behaves as signed out and this
 * returns an empty array — which is still a controlled projection, not an
 * absent one.
 */
export function useReaderHighlights(
  options: UseReaderHighlightsOptions,
): UseReaderHighlightsResult {
  const { highlights, scope } = useHighlights(options)

  return useMemo(() => ({ highlights, scope }), [highlights, scope])
}
