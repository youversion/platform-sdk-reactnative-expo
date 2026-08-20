import type { HighlightWriteOutcome } from '@youversion/platform-react-native-expo-core'

import {
  reportHighlightWriteError,
  type HighlightWriteError,
} from '../report-highlight-write-error'

type AssertQueuedHasNoReason = Extract<
  HighlightWriteError,
  { status: 'queued' }
> extends { reason?: unknown }
  ? never
  : true

const assertQueuedHasNoReason: AssertQueuedHasNoReason = true
void assertQueuedHasNoReason

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

  it('swallows a throwing onHighlightError callback', () => {
    const onHighlightError = jest.fn(() => {
      throw new Error('consumer blew up')
    })
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() =>
      reportHighlightWriteError({ status: 'queued', verses: [1, 2] }, onHighlightError),
    ).not.toThrow()
    expect(onHighlightError).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith('onHighlightError failed:', expect.any(Error))

    consoleError.mockRestore()
  })

  it('swallows a rejected async onHighlightError callback', async () => {
    const onHighlightError = jest.fn(async () => {
      throw new Error('async consumer blew up')
    })
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() =>
      reportHighlightWriteError({ status: 'queued', verses: [1, 2] }, onHighlightError),
    ).not.toThrow()
    expect(onHighlightError).toHaveBeenCalledTimes(1)

    await Promise.resolve()
    expect(consoleError).toHaveBeenCalledWith('onHighlightError failed:', expect.any(Error))

    consoleError.mockRestore()
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

  it('queued member has no reason field at the type level', () => {
    // @ts-expect-error — queued outcomes never carry reason
    const illegal: HighlightWriteError = { status: 'queued', reason: 'transient', verses: [1] }
    void illegal
  })
})
