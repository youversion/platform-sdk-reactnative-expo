import type { HighlightScope } from '@youversion/platform-react-native-expo-core'
import type { BibleReaderHighlightIntent } from '@youversion/platform-react-ui'

/**
 * What a highlight swatch tap should do, decided before any write is issued.
 *
 * - `write` — signed in and believed to hold the `highlights` permission.
 * - `prompt-sign-in` — signed out with `auth` configured on the provider.
 * - `prompt-permission` — signed in without the grant; needs just-in-time consent.
 * - `noop` — nothing to do, and nothing to say about it.
 *
 * The two prompt outcomes are declared but not yet returned: the sheet and the
 * just-in-time alert land with the permission flow. Until then an ungranted or
 * signed-out tap is a silent no-op, which is what the swatches already do today.
 */
export type HighlightTapGate = 'write' | 'prompt-sign-in' | 'prompt-permission' | 'noop'

export type HighlightTapGateInput = {
  /** The intent the reader emitted, carrying the scope it was tapped in. */
  intent: BibleReaderHighlightIntent
  /** The scope the native side is currently showing. */
  scope: HighlightScope
  /** `auth` is configured on `YouVersionProvider`. */
  isAuthConfigured: boolean
  isSignedIn: boolean
  /** Client-side belief, not a server fact — a 401/403 on the write is the real check. */
  hasHighlightsPermission: boolean
}

/**
 * Does this intent belong to the chapter currently on screen?
 *
 * An intent is emitted inside the WebView and crosses the bridge asynchronously,
 * so a tap can land after the reader has already moved on. Writing it would
 * paint the previous chapter's selection into the new chapter.
 */
export function isIntentInScope(
  intent: Pick<BibleReaderHighlightIntent, 'versionId' | 'book' | 'chapter'>,
  scope: HighlightScope,
): boolean {
  return (
    intent.versionId === scope.versionId &&
    intent.book === scope.book &&
    intent.chapter === scope.chapter
  )
}

/**
 * The tap fork, kept pure so it is testable without a renderer — the precedent
 * `lib/version-picker-panels.ts` and `lib/resolve-theme.ts` set.
 *
 * Scope is checked before auth: a stale intent is dropped outright rather than
 * prompting a signed-out user to sign in for a chapter they already left.
 */
export function gateHighlightTap(input: HighlightTapGateInput): HighlightTapGate {
  const { intent, scope, isAuthConfigured, isSignedIn, hasHighlightsPermission } = input

  if (!isIntentInScope(intent, scope)) {
    return 'noop'
  }

  // No auth configured means the host never opted into highlights. Prompting
  // would offer a sign-in the host cannot complete.
  if (!isAuthConfigured) {
    return 'noop'
  }

  if (!isSignedIn) {
    // Becomes 'prompt-sign-in' once the sign-in sheet exists.
    return 'noop'
  }

  if (!hasHighlightsPermission) {
    // Becomes 'prompt-permission' once the just-in-time alert exists.
    return 'noop'
  }

  return 'write'
}
