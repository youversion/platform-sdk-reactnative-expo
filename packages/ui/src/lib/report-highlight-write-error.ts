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

function invokeHighlightErrorHandler(
  onHighlightError: (error: HighlightWriteError) => void,
  error: HighlightWriteError,
): void {
  try {
    void Promise.resolve(onHighlightError(error)).catch((err) => {
      console.error('onHighlightError failed:', err)
    })
  } catch (err) {
    console.error('onHighlightError failed:', err)
  }
}

export function reportHighlightWriteError(
  outcome: HighlightWriteOutcome,
  onHighlightError?: (error: HighlightWriteError) => void,
): void {
  if (onHighlightError === undefined) {
    return
  }
  if (outcome.status === 'queued') {
    invokeHighlightErrorHandler(onHighlightError, { status: 'queued', verses: outcome.verses })
    return
  }
  if (outcome.status === 'error' && outcome.reason === 'transient') {
    invokeHighlightErrorHandler(onHighlightError, {
      status: 'error',
      reason: 'transient',
      verses: outcome.failedVerses,
      message: outcome.message,
    })
  }
}
