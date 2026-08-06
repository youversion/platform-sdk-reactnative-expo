import type {
  Highlight,
  HighlightScope,
  HighlightWriteOutcome,
} from '@youversion/platform-react-native-expo-core'
import { useHighlights, useYVAuthOptional } from '@youversion/platform-react-native-expo-core'
import type { BibleReaderHighlightIntent } from '@youversion/platform-react-ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { HIGHLIGHTS_PERMISSION } from '../lib/constants'
import { gateHighlightTap, isIntentInScope } from '../lib/highlight-tap-gate'

/**
 * The failing half of core's write outcome. Writes report once, through their
 * return value — never through `useHighlights().error`, which is fetch-only —
 * so this is the whole channel a failed highlight has to speak on.
 *
 * `reason: 'transient'` is the only one that reaches a consumer, and since the
 * persisted retry queue landed it means **"not saved yet, queued and retrying"**
 * rather than "didn't save". The paint stays on screen and the write survives an
 * app kill; the right host response is an offline/pending hint, not an error
 * toast telling the user to try again.
 */
export type HighlightWriteError = Extract<HighlightWriteOutcome, { status: 'error' }>

/**
 * Which prompt, if any, a **Pending Highlight** is waiting on.
 *
 * Only the two visible phases cross back to the wrapper. The in-flight states
 * (`signing-in`, `replay-sign-in`) are internal: during them the sheet is closed
 * and no alert shows, so as far as the reader is concerned nothing is prompting.
 */
export type ReaderHighlightPrompt = 'none' | 'sign-in' | 'permission'

export type UseReaderHighlightsOptions = {
  versionId: number
  book: string
  chapter: string
  /** Consumer-facing signal for a write that has not reached the server yet. */
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
  /**
   * Re-fetch this chapter's highlights from the server, picking up anything
   * created on another device. Core already revalidates on a
   * background → foreground transition; this is the half the SDK cannot detect
   * on its own — navigation focus — and it is what `BibleReader` re-exposes as
   * the `refreshHighlights` ref handle.
   *
   * Never gates rendering: the painted highlights stay on screen throughout.
   */
  refresh: () => Promise<void>
  /** Drives the sign-in sheet's visibility and the just-in-time alert. */
  prompt: ReaderHighlightPrompt
  /** "Yes Please" / "Continue" — advances whichever prompt is showing. */
  onPromptConfirm: () => void
  /**
   * Every cancellation exit: "No Thanks", the sheet's swipe-down or backdrop,
   * and the alert's Cancel. Clears the Pending Highlight so verse-selection
   * state can't drift out of sync with what the user believes is queued.
   */
  onPromptDismiss: () => void
}

/** A tap that couldn't be written yet, held until the user finishes consenting. */
type PendingHighlight = {
  op: 'apply' | 'remove'
  intent: BibleReaderHighlightIntent
}

/**
 * In-memory only, deliberately (design Resolved Question 6). `expo-web-browser`
 * opens a modal browser over a live JS context, so this survives both the PKCE
 * and data-exchange sessions without persistence — and persisting a *pre-auth*
 * intent that outlives the session it was waiting on would produce a highlight
 * appearing minutes later with no user action. Distinct from a **Pending
 * Operation**, which is an already-authorized write and does persist.
 */
type PromptPhase =
  | { kind: 'none' }
  | { kind: 'sign-in' }
  /** PKCE browser session in flight. The sheet is closed; nothing to resolve yet. */
  | { kind: 'signing-in' }
  | { kind: 'permission' }

const NONE: PromptPhase = { kind: 'none' }

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

  const { highlights, scope, apply, remove, refresh } = useHighlights({ versionId, book, chapter })
  const auth = useYVAuthOptional()

  const isAuthConfigured = auth !== null
  // Mirrors core's own write gate, which keys on the cached user id rather than
  // `isAuthenticated`. `AuthProvider` seeds `userInfo` synchronously but loads
  // the access token asynchronously, so during that window the user genuinely
  // is signed in while `isAuthenticated` is still false. Gating on the token
  // here would send an already signed-in user to the sign-in prompt; core's
  // token-loading hold exists to cover exactly this and paints regardless.
  const isSignedIn = auth !== null && (auth.isAuthenticated || auth.userInfo?.id != null)
  // The real mirror, as of Phase 3. Still a client-side belief rather than a
  // server fact — a 401/403 on the write is the ultimate check, and core
  // invalidates the grant on that outcome so the next tap routes here instead of
  // failing again.
  const hasHighlightsPermission = isSignedIn && auth.hasPermission(HIGHLIGHTS_PERMISSION)

  const [phase, setPhase] = useState<PromptPhase>(NONE)
  const pendingRef = useRef<PendingHighlight | null>(null)
  /** Set when a PKCE session returns; read once by the settle effect below. */
  const replayArmedRef = useRef(false)

  // Consumers pass inline arrow functions; reading the latest through a ref
  // keeps the bridge handlers from getting a new identity every render.
  const onHighlightErrorRef = useRef(onHighlightError)

  // Everything the async paths need *after* a browser session returns. Reading
  // these through a ref rather than a closure is what makes "re-gate against the
  // CURRENT scope" true: the reader may have moved chapters while the hosted
  // consent page was up. Declared first so it is refreshed before the replay
  // effect below runs in the same commit.
  const latestRef = useRef({ scope, apply, remove, refresh, auth })
  useEffect(() => {
    onHighlightErrorRef.current = onHighlightError
    latestRef.current = { scope, apply, remove, refresh, auth }
  })

  const reportOutcome = useCallback((outcome: HighlightWriteOutcome) => {
    if (outcome.status !== 'error') {
      return
    }
    switch (outcome.reason) {
      case 'transient':
        // Not lost — queued. Core has persisted the write and will keep retrying
        // with backoff, and the paint stays on screen throughout, so this is a
        // "still saving" signal rather than a failure. Surfacing it at all is the
        // host's call; the SDK doesn't own toast styling.
        onHighlightErrorRef.current?.(outcome)
        return
      case 'invalid':
        // A bug in our payload (bad passage id, rejected color, `uuid_parsing`
        // 422). The user can't act on it, so don't make it their problem.
        console.error('[YouVersion SDK] Highlight write rejected:', outcome.message)
        return
      case 'auth':
      case 'not-signed-in':
        // Core has already invalidated the `highlights` grant on `auth`, so the
        // next tap gates to `prompt-permission` rather than failing again. There
        // is nothing to say to the user about this one.
        return
    }
  }, [])

  const clearPending = useCallback(() => {
    pendingRef.current = null
  }, [])

  /**
   * Write a Pending Highlight now that consent is in hand — but only if it still
   * belongs to the chapter on screen. A pending highlight whose scope no longer
   * matches after the browser session is dropped, not painted into the new
   * chapter.
   */
  const replayPending = useCallback(async () => {
    const pending = pendingRef.current
    pendingRef.current = null
    if (pending === null) {
      return
    }
    const { scope: currentScope, apply: currentApply, remove: currentRemove } = latestRef.current
    if (!isIntentInScope(pending.intent, currentScope)) {
      return
    }
    const write = pending.op === 'apply' ? currentApply : currentRemove
    reportOutcome(await write(pending.intent.color, pending.intent.verses))
  }, [reportOutcome])

  const runIntent = useCallback(
    async (op: 'apply' | 'remove', intent: BibleReaderHighlightIntent): Promise<void> => {
      const gate = gateHighlightTap({
        intent,
        scope,
        isAuthConfigured,
        isSignedIn,
        hasHighlightsPermission,
      })

      switch (gate) {
        case 'write': {
          const outcome = await (op === 'apply' ? apply : remove)(intent.color, intent.verses)
          reportOutcome(outcome)
          return
        }
        case 'prompt-sign-in':
          pendingRef.current = { op, intent }
          setPhase({ kind: 'sign-in' })
          return
        case 'prompt-permission':
          pendingRef.current = { op, intent }
          setPhase({ kind: 'permission' })
          return
        case 'noop':
          // Auth not configured, or a tap that raced a chapter change. Silent by
          // design: prompting would offer a sign-in the host can't complete, or
          // write into a chapter the user is no longer looking at.
          return
      }
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

  /**
   * The one-step path. `signIn()` resolves before React has committed the new
   * token and the seeded grant, so there is nothing trustworthy to inspect at the
   * await point — arm the replay and let the effect below read settled state.
   *
   * Leaving `signing-in` is what guarantees that effect runs: a *cancelled*
   * sign-in schedules no auth update at all, so without a phase change nothing
   * would re-render and the pending highlight would linger. The auth updates a
   * *successful* sign-in schedules were made before this one and batch with it,
   * so the effect sees the signed-in state on the same commit.
   */
  const runSignIn = useCallback(async () => {
    setPhase({ kind: 'signing-in' })
    try {
      await latestRef.current.auth?.signIn()
    } catch {
      // `signIn` already surfaces its own failure through auth context's `error`.
      // Here it just means we are still signed out, which the effect handles.
    }
    replayArmedRef.current = true
    setPhase(NONE)
  }, [])

  useEffect(() => {
    if (!replayArmedRef.current) {
      return
    }
    replayArmedRef.current = false
    // Apply the pending highlight only if the user is now signed in *and*
    // `highlights` came back granted; a sign-in that completes without it clears
    // the pending highlight rather than painting something the server rejects.
    if (isSignedIn && hasHighlightsPermission) {
      void replayPending()
    } else {
      clearPending()
    }
  }, [phase.kind, isSignedIn, hasHighlightsPermission, replayPending, clearPending])

  /**
   * The two-step path. Unlike sign-in, the data exchange hands the grant back as
   * its return value, so there is no settling to wait on.
   */
  const runPermissionExchange = useCallback(async () => {
    setPhase(NONE)
    const requestPermission = latestRef.current.auth?.requestPermission
    if (requestPermission === undefined) {
      clearPending()
      return
    }

    const result = await requestPermission(HIGHLIGHTS_PERMISSION)
    // `granted` means the exchange completed, not that we got what we asked for
    // — the hosted page answers with everything it granted, which can be a
    // subset. Deny, cancel, and failure all land in the same place.
    if (result.kind !== 'granted' || !result.permissions.includes(HIGHLIGHTS_PERMISSION)) {
      clearPending()
      return
    }

    await replayPending()
    // Swift's `ensureHighlightsForChapterLoaded(forceReload: true)`: the account
    // may already hold highlights for this chapter that we were never allowed to
    // read, so pull them in alongside the one just applied.
    await latestRef.current.refresh()
  }, [clearPending, replayPending])

  const onPromptConfirm = useCallback(() => {
    if (phase.kind === 'sign-in') {
      void runSignIn()
      return
    }
    if (phase.kind === 'permission') {
      void runPermissionExchange()
    }
  }, [phase.kind, runSignIn, runPermissionExchange])

  const onPromptDismiss = useCallback(() => {
    clearPending()
    setPhase(NONE)
  }, [clearPending])

  const prompt: ReaderHighlightPrompt =
    phase.kind === 'sign-in' || phase.kind === 'permission' ? phase.kind : 'none'

  return useMemo(
    () => ({
      highlights,
      scope,
      onHighlightApply,
      onHighlightRemove,
      refresh,
      prompt,
      onPromptConfirm,
      onPromptDismiss,
    }),
    [
      highlights,
      scope,
      onHighlightApply,
      onHighlightRemove,
      refresh,
      prompt,
      onPromptConfirm,
      onPromptDismiss,
    ],
  )
}
