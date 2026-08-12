import type { HighlightWriteOutcome } from '@youversion/platform-react-native-expo-core'

/**
 * Consumer-facing slice of a highlight write outcome. Fired only for offline or
 * queued writes — not auth, invalid, ok, or noop.
 */
export type HighlightWriteError = {
  status: 'queued' | 'error'
  reason?: 'transient'
  verses: number[]
  message?: string
}

export function reportHighlightWriteError(
  outcome: HighlightWriteOutcome,
  onHighlightError?: (error: HighlightWriteError) => void,
): void {
  if (onHighlightError === undefined) {
    return
  }
  if (outcome.status === 'queued') {
    onHighlightError({ status: 'queued', verses: outcome.verses })
    return
  }
  if (outcome.status === 'error' && outcome.reason === 'transient') {
    onHighlightError({
      status: 'error',
      reason: 'transient',
      verses: outcome.failedVerses,
      message: outcome.message,
    })
  }
}
