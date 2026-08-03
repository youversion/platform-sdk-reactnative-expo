import type { DataExchangeOutcome } from '../../auth'
import type { HighlightScope } from '../constants'
import {
  HIGHLIGHTS_PERMISSION,
  initialPermissionFlowState,
  permissionFlowReducer,
  toWriteReason,
  type PendingHighlight,
  type PermissionFlowEvent,
  type PermissionFlowState,
} from '../permission-flow'
import type { HighlightWriteOutcome } from '../use-highlights'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const YELLOW = 'fffe00'
const scope: HighlightScope = { versionId: 111, book: 'JHN', chapter: '3' }

/** Frozen so any transition that "keeps the pending intact" has to mean it. */
const pending: PendingHighlight = Object.freeze({ color: YELLOW, verses: [16, 17], scope })

const granted = (permissions: string[] = [HIGHLIGHTS_PERMISSION]): DataExchangeOutcome => ({
  status: 'granted',
  grantedPermissions: permissions,
})

const authWriteError = (
  failedVerses: number[],
  message = 'unauthorized',
): HighlightWriteOutcome => ({
  status: 'error',
  reason: 'auth',
  message,
  failedVerses,
  succeededVerses: [],
})

function run(
  events: PermissionFlowEvent[],
  from: PermissionFlowState = initialPermissionFlowState,
): PermissionFlowState {
  return events.reduce(permissionFlowReducer, from)
}

const TAP_SIGN_IN: PermissionFlowEvent = { type: 'TAP', pending, branch: 'sign-in' }
const TAP_CONSENT: PermissionFlowEvent = { type: 'TAP', pending, branch: 'consent' }

// ── The two branches ─────────────────────────────────────────────────────────

describe('the not-signed-in branch', () => {
  it('reaches applying with the original pending highlight intact', () => {
    const state = run([TAP_SIGN_IN, { type: 'SIGN_IN_DONE', signedIn: true, hasPermission: true }])

    expect(state).toEqual({ step: 'applying', pending, retried: false })
    // Not merely equal — the same intent the user expressed before signing in.
    expect(state.step === 'applying' && state.pending).toBe(pending)
  })

  it('falls through to consent when signing in did not grant the permission', () => {
    const state = run([TAP_SIGN_IN, { type: 'SIGN_IN_DONE', signedIn: true, hasPermission: false }])

    expect(state).toEqual({ step: 'confirming', pending, retried: false })
  })

  it('reaches applying through the consent fall-through, still holding the pending', () => {
    const state = run([
      TAP_SIGN_IN,
      { type: 'SIGN_IN_DONE', signedIn: true, hasPermission: false },
      { type: 'CONFIRM' },
      { type: 'GRANT_RESULT', outcome: granted() },
    ])

    expect(state).toEqual({ step: 'applying', pending, retried: false })
  })

  it('discards the pending highlight when sign-in is cancelled', () => {
    const state = run([
      TAP_SIGN_IN,
      { type: 'SIGN_IN_DONE', signedIn: false, hasPermission: false },
    ])

    expect(state).toEqual({ step: 'idle', error: null })
    expect('pending' in state).toBe(false)
  })

  it('treats a cancel as no failure at all — nothing to surface', () => {
    const state = run([
      TAP_SIGN_IN,
      { type: 'SIGN_IN_DONE', signedIn: false, hasPermission: false },
    ])

    expect(state.step === 'idle' && state.error).toBeNull()
  })
})

describe('the signed-in-without-permission branch', () => {
  it('opens the consent prompt on tap', () => {
    expect(run([TAP_CONSENT])).toEqual({ step: 'confirming', pending, retried: false })
  })

  it('reaches applying with the original pending highlight intact', () => {
    const state = run([
      TAP_CONSENT,
      { type: 'CONFIRM' },
      { type: 'GRANT_RESULT', outcome: granted() },
    ])

    expect(state).toEqual({ step: 'applying', pending, retried: false })
    expect(state.step === 'applying' && state.pending).toBe(pending)
  })

  it('discards the pending highlight on decline', () => {
    const state = run([TAP_CONSENT, { type: 'DECLINE' }])

    expect(state).toEqual({ step: 'idle', error: null })
    expect('pending' in state).toBe(false)
  })

  it('discards the pending highlight when the grant is cancelled, without an error', () => {
    const state = run([
      TAP_CONSENT,
      { type: 'CONFIRM' },
      { type: 'GRANT_RESULT', outcome: { status: 'cancel' } },
    ])

    expect(state).toEqual({ step: 'idle', error: null })
  })

  it('surfaces a grant failure and reverts to idle', () => {
    const state = run([
      TAP_CONSENT,
      { type: 'CONFIRM' },
      {
        type: 'GRANT_RESULT',
        outcome: { status: 'failure', reason: 'not-permitted', message: 'nope' },
      },
    ])

    expect(state).toEqual({
      step: 'idle',
      error: { reason: 'not-permitted', message: 'nope' },
    })
    expect('pending' in state).toBe(false)
  })

  it('does not apply when the grant came back without the highlights permission', () => {
    const state = run([
      TAP_CONSENT,
      { type: 'CONFIRM' },
      { type: 'GRANT_RESULT', outcome: granted(['bibles']) },
    ])

    expect(state.step).toBe('idle')
    expect(state.step === 'idle' && state.error?.reason).toBe('not-permitted')
  })
})

// ── The corrective path ──────────────────────────────────────────────────────

describe('the stale-grant corrective path', () => {
  it('re-prompts once on an auth refusal, replaying only the verses that failed', () => {
    const state = run([{ type: 'AUTH_RETRY', pending }], {
      step: 'applying',
      pending,
      retried: false,
    })
    // AUTH_RETRY is an *entry* event and is ignored mid-flow — the applying state
    // gets there through APPLY_RESULT instead.
    expect(state).toEqual({ step: 'applying', pending, retried: false })

    const reprompted = permissionFlowReducer(
      { step: 'applying', pending, retried: false },
      { type: 'APPLY_RESULT', outcome: authWriteError([17]) },
    )

    expect(reprompted).toEqual({
      step: 'confirming',
      pending: { color: YELLOW, verses: [17], scope },
      retried: true,
    })
  })

  it('enters at confirming with retried already set when a fast-path write is refused', () => {
    expect(run([{ type: 'AUTH_RETRY', pending }])).toEqual({
      step: 'confirming',
      pending,
      retried: true,
    })
  })

  it('goes terminal on a second auth refusal instead of re-prompting again', () => {
    const state = run(
      [
        { type: 'CONFIRM' },
        { type: 'GRANT_RESULT', outcome: granted() },
        { type: 'APPLY_RESULT', outcome: authWriteError([17], 'still unauthorized') },
      ],
      { step: 'confirming', pending, retried: true },
    )

    expect(state).toEqual({
      step: 'idle',
      error: { reason: 'auth', message: 'still unauthorized' },
    })
  })

  it('carries `retried` across confirm and grant so the bound cannot be laundered', () => {
    const state = run([{ type: 'CONFIRM' }, { type: 'GRANT_RESULT', outcome: granted() }], {
      step: 'confirming',
      pending,
      retried: true,
    })

    expect(state).toEqual({ step: 'applying', pending, retried: true })
  })

  it('goes terminal rather than re-prompting when an auth refusal names no verses', () => {
    const state = permissionFlowReducer(
      { step: 'applying', pending, retried: false },
      { type: 'APPLY_RESULT', outcome: authWriteError([]) },
    )

    expect(state).toEqual({ step: 'idle', error: { reason: 'auth', message: 'unauthorized' } })
  })

  it.each([
    ['ok', { status: 'ok', verses: [16, 17] } as HighlightWriteOutcome],
    ['noop', { status: 'noop' } as HighlightWriteOutcome],
    [
      'a non-auth error',
      {
        status: 'error',
        reason: 'transient',
        message: 'boom',
        failedVerses: [16],
        succeededVerses: [],
      } as HighlightWriteOutcome,
    ],
  ])('ends the flow cleanly on %s, leaving the write to report itself', (_label, outcome) => {
    const state = permissionFlowReducer(
      { step: 'applying', pending, retried: false },
      { type: 'APPLY_RESULT', outcome },
    )

    expect(state).toEqual({ step: 'idle', error: null })
  })
})

// ── RESET ────────────────────────────────────────────────────────────────────

describe('RESET', () => {
  const steps: PermissionFlowState[] = [
    { step: 'signing-in', pending },
    { step: 'confirming', pending, retried: false },
    { step: 'granting', pending, retried: true },
    { step: 'applying', pending, retried: false },
  ]

  it.each(steps.map((s) => [s.step, s] as const))(
    'discards a flow in progress from %s',
    (_step, state) => {
      expect(permissionFlowReducer(state, { type: 'RESET' })).toEqual({
        step: 'idle',
        error: null,
      })
    },
  )

  it('clears a terminal error, so a failure cannot outlive the chapter it happened in', () => {
    const state = permissionFlowReducer(
      { step: 'idle', error: { reason: 'transient', message: 'boom' } },
      { type: 'RESET' },
    )

    expect(state).toEqual({ step: 'idle', error: null })
  })

  it('is identity-stable when already clean, so React can skip the re-render', () => {
    expect(permissionFlowReducer(initialPermissionFlowState, { type: 'RESET' })).toBe(
      initialPermissionFlowState,
    )
  })
})

// ── Stale and invalid events ─────────────────────────────────────────────────

describe('events invalid for the current step', () => {
  const states: PermissionFlowState[] = [
    initialPermissionFlowState,
    { step: 'signing-in', pending },
    { step: 'confirming', pending, retried: false },
    { step: 'granting', pending, retried: false },
    { step: 'applying', pending, retried: false },
  ]

  const events: PermissionFlowEvent[] = [
    TAP_SIGN_IN,
    TAP_CONSENT,
    { type: 'AUTH_RETRY', pending },
    { type: 'SIGN_IN_DONE', signedIn: true, hasPermission: true },
    { type: 'CONFIRM' },
    { type: 'DECLINE' },
    { type: 'GRANT_RESULT', outcome: granted() },
    { type: 'APPLY_RESULT', outcome: { status: 'ok', verses: [16, 17] } },
  ]

  /** The only event each step is willing to hear (RESET aside, which is universal). */
  const validFor: Record<PermissionFlowState['step'], PermissionFlowEvent['type'][]> = {
    idle: ['TAP', 'AUTH_RETRY'],
    'signing-in': ['SIGN_IN_DONE'],
    confirming: ['CONFIRM', 'DECLINE'],
    granting: ['GRANT_RESULT'],
    applying: ['APPLY_RESULT'],
  }

  for (const state of states) {
    for (const event of events) {
      if (validFor[state.step].includes(event.type)) {
        continue
      }
      const label = event.type === 'TAP' ? `TAP(${event.branch})` : event.type
      it(`ignores ${label} in ${state.step}`, () => {
        expect(permissionFlowReducer(state, event)).toBe(state)
      })
    }
  }

  it('cannot be resurrected by a browser result that lands after a RESET', () => {
    // The exact sequence a real cancel-then-return produces: the reader moved on
    // while the consent page was open, and the grant arrives to an empty flow.
    const state = run([
      TAP_CONSENT,
      { type: 'CONFIRM' },
      { type: 'RESET' },
      { type: 'GRANT_RESULT', outcome: granted() },
    ])

    expect(state).toEqual({ step: 'idle', error: null })
    expect('pending' in state).toBe(false)
  })

  it('cannot be resurrected by a sign-in that lands after a RESET', () => {
    const state = run([
      TAP_SIGN_IN,
      { type: 'RESET' },
      { type: 'SIGN_IN_DONE', signedIn: true, hasPermission: true },
    ])

    expect(state).toEqual({ step: 'idle', error: null })
  })

  it('ignores an event it does not recognise rather than corrupting the flow', () => {
    const state: PermissionFlowState = { step: 'granting', pending, retried: false }
    // Reachable from untyped callers and from a hot reload mid-flow.
    const bogus = { type: 'SOMETHING_ELSE' } as unknown as PermissionFlowEvent

    expect(permissionFlowReducer(state, bogus)).toBe(state)
  })
})

// ── Reason mapping ───────────────────────────────────────────────────────────

describe('toWriteReason', () => {
  it.each([
    ['not-signed-in', 'not-signed-in'],
    ['auth', 'auth'],
    ['not-permitted', 'invalid'],
    ['user-changed', 'transient'],
    ['transient', 'transient'],
  ] as const)('maps %s to %s', (from, to) => {
    expect(toWriteReason(from)).toBe(to)
  })
})
