import type { HighlightWriteOutcome } from '@youversion/platform-react-native-expo-core'

import { reportHighlightWriteError } from '../report-highlight-write-error'

describe('reportHighlightWriteError', () => {
  it('fires for queued outcomes', () => {
    const onHighlightError = jest.fn()

    reportHighlightWriteError({ status: 'queued', verses: [1, 2] }, onHighlightError)

    expect(onHighlightError).toHaveBeenCalledWith({ status: 'queued', verses: [1, 2] })
  })

  it('fires for transient error outcomes', () => {
    const onHighlightError = jest.fn()

    reportHighlightWriteError(
      {
        status: 'error',
        reason: 'transient',
        message: 'Network request failed',
        failedVerses: [1, 2],
        succeededVerses: [],
      },
      onHighlightError,
    )

    expect(onHighlightError).toHaveBeenCalledWith({
      status: 'error',
      reason: 'transient',
      verses: [1, 2],
      message: 'Network request failed',
    })
  })

  it('does nothing when no handler is passed', () => {
    expect(() =>
      reportHighlightWriteError({ status: 'queued', verses: [1, 2] }),
    ).not.toThrow()
  })

  it.each([
    ['ok', { status: 'ok', verses: [1, 2] } satisfies HighlightWriteOutcome],
    ['noop', { status: 'noop' } satisfies HighlightWriteOutcome],
    [
      'invalid',
      {
        status: 'error',
        reason: 'invalid',
        message: 'Unsupported highlight color.',
        failedVerses: [1, 2],
        succeededVerses: [],
      } satisfies HighlightWriteOutcome,
    ],
    [
      'auth',
      {
        status: 'error',
        reason: 'auth',
        message: 'Request failed with status 403',
        failedVerses: [1, 2],
        succeededVerses: [],
      } satisfies HighlightWriteOutcome,
    ],
    [
      'not-signed-in',
      {
        status: 'error',
        reason: 'not-signed-in',
        message: 'Not signed in',
        failedVerses: [1, 2],
        succeededVerses: [],
      } satisfies HighlightWriteOutcome,
    ],
  ] as const)('does not fire for %s outcomes', (_label, outcome) => {
    const onHighlightError = jest.fn()

    reportHighlightWriteError(outcome, onHighlightError)

    expect(onHighlightError).not.toHaveBeenCalled()
  })
})
