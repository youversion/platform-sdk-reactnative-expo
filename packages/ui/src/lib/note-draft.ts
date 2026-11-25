import type { BibleReaderVerseRange } from '../types/verse-hook-types'

export type NoteVisibility = 'private' | 'public'

/** The account a draft belongs to. A mismatch drops the draft. */
export type NoteAccount = {
  userId: string
  appKey: string
  apiHost: string
}

export type NoteDraft = {
  ranges: readonly BibleReaderVerseRange[]
  title: string
  versionId: number
  passageId: string
  verses: readonly number[]
  text: string
  visibility: NoteVisibility
  /** Palette hex without `#`, or null when the passage is saved with no color. */
  color: string | null
  requestId: string
  /** Null until sign-in binds it. A bound draft dies when this account leaves. */
  account: NoteAccount | null
}

export type NoteAuthGate = 'unconfigured' | 'settling' | 'signed-out' | 'ready'

export type NoteFlow =
  | { status: 'idle' }
  | { status: 'waiting'; draft: NoteDraft }
  | { status: 'needs-auth'; draft: NoteDraft; attemptId: string }
  | {
      status: 'composing'
      draft: NoteDraft
      saving: boolean
      saveError: boolean
      confirmDiscard: boolean
    }

export type NoteFlowEvent =
  | {
      type: 'start'
      draft: NoteDraft
      gate: NoteAuthGate
      hasWriteNotes: boolean
      account: NoteAccount | null
    }
  | {
      type: 'auth-settled'
      gate: NoteAuthGate
      hasWriteNotes: boolean
      account: NoteAccount | null
    }
  | { type: 'begin-sign-in'; attemptId: string }
  | {
      type: 'sign-in-finished'
      attemptId: string
      grantedWriteNotes: boolean
      account: NoteAccount | null
    }
  | { type: 'sign-in-cancelled'; attemptId: string }
  | { type: 'set-text'; text: string }
  | { type: 'set-visibility'; visibility: NoteVisibility }
  | { type: 'set-color'; color: string | null }
  | { type: 'save-started' }
  | { type: 'save-failed'; requestId: string }
  | { type: 'save-succeeded'; requestId: string }
  | { type: 'dismiss-error' }
  | { type: 'request-dismiss' }
  | { type: 'confirm-discard' }
  | { type: 'keep-editing' }
  | { type: 'account-changed'; account: NoteAccount | null }
  | { type: 'left-passage' }

export type NoteFlowStep = {
  flow: NoteFlow
  /** Verses to put back on the chapter. Null means leave the selection alone. */
  restoreVerses: readonly number[] | null
}

const idleStep: NoteFlowStep = { flow: { status: 'idle' }, restoreVerses: null }

export function sameNoteAccount(a: NoteAccount, b: NoteAccount): boolean {
  return a.userId === b.userId && a.appKey === b.appKey && a.apiHost === b.apiHost
}

/** One passage id. Gaps stay as separate ranges joined with `+`. */
export function notePassageId(ranges: readonly BibleReaderVerseRange[]): string | null {
  const first = ranges[0]
  if (first === undefined) {
    return null
  }
  for (const range of ranges) {
    if (
      range.versionId !== first.versionId ||
      range.book !== first.book ||
      range.chapter !== first.chapter
    ) {
      return null
    }
    if (range.passageId.trim().length === 0) {
      return null
    }
  }
  return ranges.map((range) => range.passageId).join('+')
}

export function noteDraftIsDirty(draft: NoteDraft): boolean {
  return draft.text !== '' || draft.visibility !== 'private' || draft.color !== null
}

function keep(flow: NoteFlow): NoteFlowStep {
  return { flow, restoreVerses: null }
}

function composing(draft: NoteDraft): NoteFlow {
  return {
    status: 'composing',
    draft,
    saving: false,
    saveError: false,
    confirmDiscard: false,
  }
}

function openOrPark(
  draft: NoteDraft,
  gate: NoteAuthGate,
  hasWriteNotes: boolean,
  account: NoteAccount | null,
): NoteFlowStep {
  if (gate === 'unconfigured') {
    return idleStep
  }
  if (draft.account !== null && (account === null || !sameNoteAccount(draft.account, account))) {
    return idleStep
  }
  const parked = { ...draft, account: draft.account ?? account }
  if (gate === 'settling') {
    return keep({ status: 'waiting', draft: parked })
  }
  if (gate === 'ready' && hasWriteNotes) {
    return keep(composing(parked))
  }
  return keep({ status: 'needs-auth', draft: parked, attemptId: '' })
}

function draftOf(flow: NoteFlow): NoteDraft | null {
  if (flow.status === 'idle') {
    return null
  }
  return flow.draft
}

export function noteFlowReducer(
  flow: NoteFlow,
  event: NoteFlowEvent,
  nextRequestId: () => string,
): NoteFlowStep {
  switch (event.type) {
    case 'start':
      return openOrPark(event.draft, event.gate, event.hasWriteNotes, event.account)
    case 'auth-settled': {
      if (flow.status !== 'waiting' && flow.status !== 'needs-auth') {
        return keep(flow)
      }
      if (flow.status === 'needs-auth' && flow.attemptId !== '') {
        return keep(flow)
      }
      return openOrPark(flow.draft, event.gate, event.hasWriteNotes, event.account)
    }
    case 'begin-sign-in': {
      if (flow.status !== 'needs-auth' || flow.attemptId !== '') {
        return keep(flow)
      }
      return keep({ ...flow, attemptId: event.attemptId })
    }
    case 'sign-in-finished': {
      if (flow.status !== 'needs-auth' || flow.attemptId === '' || flow.attemptId !== event.attemptId) {
        return keep(flow)
      }
      const { draft } = flow
      if (!event.grantedWriteNotes) {
        return { flow: { status: 'idle' }, restoreVerses: draft.verses }
      }
      if (draft.account !== null && (event.account === null || !sameNoteAccount(draft.account, event.account))) {
        return idleStep
      }
      return keep(composing({ ...draft, account: event.account ?? draft.account }))
    }
    case 'sign-in-cancelled': {
      if (flow.status !== 'needs-auth') {
        return keep(flow)
      }
      if (flow.attemptId !== '' && flow.attemptId !== event.attemptId) {
        return keep(flow)
      }
      return { flow: { status: 'idle' }, restoreVerses: flow.draft.verses }
    }
    case 'set-text':
    case 'set-visibility':
    case 'set-color': {
      if (flow.status !== 'composing' || flow.saving) {
        return keep(flow)
      }
      const { draft } = flow
      if (event.type === 'set-text' && draft.text === event.text) {
        return keep(flow)
      }
      if (event.type === 'set-visibility' && draft.visibility === event.visibility) {
        return keep(flow)
      }
      if (event.type === 'set-color' && draft.color === event.color) {
        return keep(flow)
      }
      const next = { ...draft, requestId: nextRequestId() }
      if (event.type === 'set-text') {
        next.text = event.text
      } else if (event.type === 'set-visibility') {
        next.visibility = event.visibility
      } else {
        next.color = event.color
      }
      return keep({ ...flow, draft: next, saveError: false })
    }
    case 'save-started': {
      if (flow.status !== 'composing' || flow.saving) {
        return keep(flow)
      }
      return keep({ ...flow, saving: true, saveError: false })
    }
    case 'save-failed': {
      if (flow.status !== 'composing' || !flow.saving || flow.draft.requestId !== event.requestId) {
        return keep(flow)
      }
      return keep({ ...flow, saving: false, saveError: true })
    }
    case 'save-succeeded': {
      if (flow.status !== 'composing' || !flow.saving || flow.draft.requestId !== event.requestId) {
        return keep(flow)
      }
      return idleStep
    }
    case 'dismiss-error': {
      if (flow.status !== 'composing') {
        return keep(flow)
      }
      return keep({ ...flow, saveError: false })
    }
    case 'request-dismiss': {
      if (flow.status !== 'composing' || flow.saving) {
        return keep(flow)
      }
      if (noteDraftIsDirty(flow.draft)) {
        return keep({ ...flow, confirmDiscard: true })
      }
      return idleStep
    }
    case 'confirm-discard':
      return flow.status === 'composing' ? idleStep : keep(flow)
    case 'keep-editing': {
      if (flow.status !== 'composing') {
        return keep(flow)
      }
      return keep({ ...flow, confirmDiscard: false })
    }
    case 'account-changed': {
      const draft = draftOf(flow)
      if (draft === null || draft.account === null) {
        return keep(flow)
      }
      if (event.account !== null && sameNoteAccount(draft.account, event.account)) {
        return keep(flow)
      }
      return idleStep
    }
    case 'left-passage':
      return flow.status === 'idle' ? keep(flow) : idleStep
    default: {
      const _exhaustive: never = event
      return _exhaustive
    }
  }
}

type CryptoWithUuid = { randomUUID?: () => string }

/** A UUID for a create. Uses the runtime when it has one, otherwise a v4-shaped id. */
export function newNoteRequestId(): string {
  // SAFETY: React Native's TypeScript lib omits `crypto`. The read is guarded below.
  const scope = globalThis as { crypto?: CryptoWithUuid }
  const randomUUID = scope.crypto?.randomUUID
  if (randomUUID !== undefined) {
    try {
      return randomUUID.call(scope.crypto)
    } catch {
      // The runtime method failed. Fall through to a local id.
    }
  }
  const bytes = new Uint8Array(16)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256)
  }
  const version = bytes[6] ?? 0
  const variant = bytes[8] ?? 0
  bytes[6] = (version & 0x0f) | 0x40
  bytes[8] = (variant & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
