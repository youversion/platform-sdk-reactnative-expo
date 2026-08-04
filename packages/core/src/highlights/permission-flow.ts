import type { AuthPermission, DataExchangeFailureReason, DataExchangeOutcome } from '../auth'
import type { HighlightScope } from './constants'
import type { HighlightWriteOutcome, HighlightWriteReason } from './use-highlights'

/**
 * The one permission this flow exists to obtain. Named so the reducer, the hook,
 * and the request it issues cannot drift apart on spelling.
 */
export const HIGHLIGHTS_PERMISSION: AuthPermission = 'highlights'

/**
 * A highlight the user asked for before they were allowed to make it — held
 * while sign-in and/or consent runs, then applied.
 *
 * In-memory only, by design: `openAuthSessionAsync` returns to the same live
 * process, so web's `sessionStorage` stash and its TTL solve a problem native
 * does not have. `scope` travels with it as identity — the chapter the intent was
 * formed in — and a scope change discards the whole flow (`RESET`) rather than
 * replaying the highlight somewhere the user is no longer looking.
 */
export type PendingHighlight = {
  color: string
  verses: number[]
  scope: HighlightScope
}

/**
 * Why a flow gave up. `auth` is the flow's own reason (the permission was
 * granted, and the server still refused the write); the rest come straight from
 * {@link DataExchangeOutcome}.
 */
export type PermissionFlowErrorReason = DataExchangeFailureReason | 'auth'

export type PermissionFlowError = {
  reason: PermissionFlowErrorReason
  message: string
}

/**
 * Where a pending highlight is in the flow.
 *
 * `retried` is carried from `confirming` onward and marks the one corrective
 * re-prompt a stale permission cache is allowed to cause. Only `idle` can hold
 * an `error`: a flow still in progress has nothing terminal to report yet, and
 * making that unrepresentable is cheaper than remembering to clear it.
 */
export type PermissionFlowState =
  | { step: 'idle'; error: PermissionFlowError | null }
  | { step: 'signing-in'; pending: PendingHighlight }
  | { step: 'confirming'; pending: PendingHighlight; retried: boolean }
  | { step: 'granting'; pending: PendingHighlight; retried: boolean }
  | { step: 'applying'; pending: PendingHighlight; retried: boolean }

/**
 * `TAP` opens a flow the pre-flight decided is needed — never the ordinary case
 * where the permission is already granted, which writes straight through and
 * must stay concurrent (see the hook).
 *
 * `AUTH_RETRY` is the corrective entry: the cached grant said yes, the write got
 * a 401/403 anyway, so the cache was stale and the user is re-prompted once.
 */
export type PermissionFlowEvent =
  | { type: 'TAP'; pending: PendingHighlight; branch: 'sign-in' | 'consent' }
  | { type: 'AUTH_RETRY'; pending: PendingHighlight }
  | { type: 'SIGN_IN_DONE'; signedIn: boolean; hasPermission: boolean }
  | { type: 'CONFIRM' }
  | { type: 'DECLINE' }
  | { type: 'GRANT_RESULT'; outcome: DataExchangeOutcome }
  | { type: 'APPLY_RESULT'; outcome: HighlightWriteOutcome }
  | { type: 'RESET' }

export const initialPermissionFlowState: PermissionFlowState = { step: 'idle', error: null }

/**
 * The clean terminal state, shared by every abandonment path. One object rather
 * than a fresh literal each time so React can bail out of a re-render when a
 * flow that was already idle is reset again.
 */
const IDLE: PermissionFlowState = initialPermissionFlowState

const GRANT_WITHOUT_HIGHLIGHTS_MESSAGE =
  'The permission grant came back without `highlights`, so the highlight was not applied.'

/**
 * The flow's whole state model: React-free, total, and pure.
 *
 * **Every event invalid for the current step returns the state unchanged.** That
 * is not defensive noise — it is the mechanism that keeps a browser round-trip
 * from resurrecting a discarded highlight. A sign-in or consent session that
 * lands after the reader moved chapters (`RESET`) finds an `idle` state and dies
 * there, instead of painting a highlight the user has scrolled away from.
 */
export function permissionFlowReducer(
  state: PermissionFlowState,
  event: PermissionFlowEvent,
): PermissionFlowState {
  switch (event.type) {
    case 'RESET':
      // Also clears a terminal error: a failure about the chapter the reader
      // just left is noise, not something to surface over the new one.
      return state.step === 'idle' && state.error === null ? state : IDLE

    case 'TAP':
      if (state.step !== 'idle') {
        return state
      }
      return event.branch === 'sign-in'
        ? { step: 'signing-in', pending: event.pending }
        : { step: 'confirming', pending: event.pending, retried: false }

    case 'AUTH_RETRY':
      if (state.step !== 'idle') {
        return state
      }
      return { step: 'confirming', pending: event.pending, retried: true }

    case 'SIGN_IN_DONE':
      if (state.step !== 'signing-in') {
        return state
      }
      // A cancel is not an error and not a failure — the user changed their
      // mind, so the highlight goes with it.
      if (!event.signedIn) {
        return IDLE
      }
      // Swift's `continuePendingHighlightAfterSignIn`: signing in may itself
      // have granted the permission (it rides on the OAuth redirect), in which
      // case asking again would be asking twice for the same thing.
      return event.hasPermission
        ? { step: 'applying', pending: state.pending, retried: false }
        : { step: 'confirming', pending: state.pending, retried: false }

    case 'CONFIRM':
      if (state.step !== 'confirming') {
        return state
      }
      return { step: 'granting', pending: state.pending, retried: state.retried }

    case 'DECLINE':
      if (state.step !== 'confirming') {
        return state
      }
      return IDLE

    case 'GRANT_RESULT': {
      if (state.step !== 'granting') {
        return state
      }
      const { outcome } = event
      if (outcome.status === 'cancel') {
        return IDLE
      }
      if (outcome.status === 'failure') {
        return { step: 'idle', error: { reason: outcome.reason, message: outcome.message } }
      }
      // `granted` reports what the server actually granted, which is not
      // necessarily what was asked for — so check the list, not the status.
      // Consenting to something else is not consent to save highlights.
      if (!outcome.grantedPermissions.includes(HIGHLIGHTS_PERMISSION)) {
        return {
          step: 'idle',
          error: { reason: 'not-permitted', message: GRANT_WITHOUT_HIGHLIGHTS_MESSAGE },
        }
      }
      return { step: 'applying', pending: state.pending, retried: state.retried }
    }

    case 'APPLY_RESULT': {
      if (state.step !== 'applying') {
        return state
      }
      const { outcome } = event
      // Anything that is not an auth refusal is the write's own business: it
      // reports through the outcome the caller is already holding.
      if (outcome.status !== 'error' || outcome.reason !== 'auth') {
        return IDLE
      }
      // One corrective re-prompt, ever. A second auth refusal after the user has
      // just granted the permission is not something more consent can fix, and
      // looping the consent page on it would be the worst possible read of it.
      if (state.retried || outcome.failedVerses.length === 0) {
        return { step: 'idle', error: { reason: 'auth', message: outcome.message } }
      }
      // Replay only what failed: a partial batch already landed the rest.
      return {
        step: 'confirming',
        pending: { ...state.pending, verses: outcome.failedVerses },
        retried: true,
      }
    }

    default:
      // Unreachable through the typed API. Kept because the reducer is the one
      // place a stray or hot-reloaded event could otherwise corrupt a flow, and
      // "ignore what you do not understand" is the same rule as every branch above.
      return state
  }
}

/**
 * Collapses a flow failure onto the four reasons a write can report, so the
 * whole flow resolves through one channel the caller already handles.
 *
 * `not-permitted` maps to `invalid` rather than `transient` on purpose: the app
 * key is not enabled for data exchange, which is a configuration fact, and
 * telling a caller to retry it would be a lie.
 *
 * `in-progress` maps to `transient` because a write refused for holding the
 * consent flow open is retryable — later, once that flow settles. A write
 * outcome has no finer bucket for "retry, but not this instant", and the flow
 * already reports an overlapping tap as `transient` for the same reason.
 */
export function toWriteReason(reason: PermissionFlowErrorReason): HighlightWriteReason {
  switch (reason) {
    case 'not-signed-in':
      return 'not-signed-in'
    case 'auth':
      return 'auth'
    case 'not-permitted':
      return 'invalid'
    case 'user-changed':
    case 'in-progress':
    case 'transient':
      return 'transient'
  }
}
