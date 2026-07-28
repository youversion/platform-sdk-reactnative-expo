import type {
  Highlight,
  HighlightScope,
  HighlightWriteOutcome,
} from '@youversion/platform-react-native-expo-core'
import { useHighlights, useYVAuthOptional } from '@youversion/platform-react-native-expo-core'
import type { BibleReaderHighlightIntent } from '@youversion/platform-react-ui'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { gateHighlightTap } from '../lib/highlight-tap-gate'

/**
 * The failing half of core's write outcome. Writes report once, through their
 * return value — never through `useHighlights().error`, which is fetch-only —
 * so this is the whole channel a failed highlight has to speak on.
 */
export type HighlightWriteError = Extract<HighlightWriteOutcome, { status: 'error' }>

export type UseReaderHighlightsOptions = {
  versionId: number
  book: string
  chapter: string
  /** Consumer-facing signal for a write the user should know didn't save. */
  onHighlightError?: (error: HighlightWriteError) => void
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
  onHighlightApply: (intent: BibleReaderHighlightIntent) => Promise<void>
  onHighlightRemove: (intent: BibleReaderHighlightIntent) => Promise<void>
}

/**
 * The reader's highlights orchestrator — the RN analogue of Swift's
 * `BibleReaderViewModel`. The native wrapper forwards taps and presents sheets;
 * this hook decides.
 *
 * It reads from and writes through core's `useHighlights`, which is the only
 * optimistic layer in the stack (ADR 0013). With no `auth` configured on
 * `YouVersionProvider`, or signed out, that hook behaves as signed out and this
 * returns an empty array — which is still a controlled projection, not an
 * absent one.
 */
export function useReaderHighlights(
  options: UseReaderHighlightsOptions,
): UseReaderHighlightsResult {
  const { versionId, book, chapter, onHighlightError } = options

  const { highlights, scope, apply, remove } = useHighlights({ versionId, book, chapter })
  const auth = useYVAuthOptional()

  const isAuthConfigured = auth !== null
  // Mirrors core's own write gate, which keys on the cached user id rather than
  // `isAuthenticated`. `AuthProvider` seeds `userInfo` synchronously but loads
  // the access token asynchronously, so during that window the user genuinely
  // is signed in while `isAuthenticated` is still false. Gating on the token
  // here would send an already signed-in user to the sign-in prompt; core's
  // token-loading hold exists to cover exactly this and paints regardless.
  const isSignedIn = auth !== null && (auth.isAuthenticated || auth.userInfo?.id != null)
  // Optimistic mirror stand-in: nothing reads back what the consent screen
  // actually granted yet, so a signed-in user is believed to hold `highlights`.
  // A denial comes back as a 401/403, which core classifies as `reason: 'auth'`
  // — the seam the just-in-time permission prompt attaches to.
  const hasHighlightsPermission = isSignedIn

  // Consumers pass inline arrow functions; reading the latest through a ref
  // keeps the bridge handlers from getting a new identity every render.
  const onHighlightErrorRef = useRef(onHighlightError)
  useEffect(() => {
    onHighlightErrorRef.current = onHighlightError
  })

  const reportOutcome = useCallback((outcome: HighlightWriteOutcome) => {
    if (outcome.status !== 'error') {
      return
    }
    switch (outcome.reason) {
      case 'transient':
        // The user's highlight didn't save and a retry may work. Surfacing it is
        // the host's call — the SDK doesn't own toast styling.
        onHighlightErrorRef.current?.(outcome)
        return
      case 'invalid':
        // A bug in our payload (bad passage id, rejected color, `uuid_parsing`
        // 422). The user can't act on it, so don't make it their problem.
        console.error('[YouVersion SDK] Highlight write rejected:', outcome.message)
        return
      case 'auth':
      case 'not-signed-in':
        // Silent for now. This is where the sign-in sheet and the just-in-time
        // permission prompt attach.
        return
    }
  }, [])

  const runIntent = useCallback(
    async (op: 'apply' | 'remove', intent: BibleReaderHighlightIntent): Promise<void> => {
      const gate = gateHighlightTap({
        intent,
        scope,
        isAuthConfigured,
        isSignedIn,
        hasHighlightsPermission,
      })

      if (gate !== 'write') {
        return
      }

      const outcome = await (op === 'apply' ? apply : remove)(intent.color, intent.verses)
      reportOutcome(outcome)
    },
    [apply, remove, scope, isAuthConfigured, isSignedIn, hasHighlightsPermission, reportOutcome],
  )

  const onHighlightApply = useCallback(
    (intent: BibleReaderHighlightIntent) => runIntent('apply', intent),
    [runIntent],
  )

  const onHighlightRemove = useCallback(
    (intent: BibleReaderHighlightIntent) => runIntent('remove', intent),
    [runIntent],
  )

  return useMemo(
    () => ({ highlights, scope, onHighlightApply, onHighlightRemove }),
    [highlights, scope, onHighlightApply, onHighlightRemove],
  )
}
