import type { BibleReaderVerseRange } from '../../types/verse-hook-types'
import {
  noteDraftIsDirty,
  noteFlowReducer,
  notePassageId,
  type NoteAccount,
  type NoteDraft,
  type NoteFlow,
} from '../note-draft'

const range = (verseStart: number, verseEnd: number, passageId: string): BibleReaderVerseRange => ({
  versionId: 111,
  book: 'JHN',
  chapter: '3',
  verseStart,
  verseEnd,
  passageId,
})

const ada: NoteAccount = { userId: 'ada', appKey: 'app', apiHost: 'api.example' }
const grace: NoteAccount = { userId: 'grace', appKey: 'app', apiHost: 'api.example' }

function draft(overrides: Partial<NoteDraft> = {}): NoteDraft {
  return {
    ranges: [range(16, 17, 'JHN.3.16-17'), range(19, 19, 'JHN.3.19')],
    title: 'John 3:16-17,19',
    versionId: 111,
    passageId: 'JHN.3.16-17+JHN.3.19',
    verses: [16, 17, 19],
    text: '',
    visibility: 'private',
    color: null,
    requestId: 'req-1',
    account: null,
    ...overrides,
  }
}

let ids = 1
const nextRequestId = () => `req-${++ids}`

function step(flow: NoteFlow, event: Parameters<typeof noteFlowReducer>[1]) {
  return noteFlowReducer(flow, event, nextRequestId)
}

beforeEach(() => {
  ids = 1
})

describe('notePassageId', () => {
  it('joins gaps with + and keeps each range', () => {
    expect(notePassageId([range(16, 17, 'JHN.3.16-17'), range(19, 19, 'JHN.3.19')])).toBe(
      'JHN.3.16-17+JHN.3.19',
    )
  })

  it('rejects an empty selection and a mixed chapter', () => {
    expect(notePassageId([])).toBeNull()
    expect(
      notePassageId([
        range(16, 16, 'JHN.3.16'),
        { ...range(1, 1, 'JHN.4.1'), chapter: '4' },
      ]),
    ).toBeNull()
  })
})

describe('note flow', () => {
  it('opens the composer when write_notes is already granted', () => {
    const result = step({ status: 'idle' }, {
      type: 'start',
      draft: draft(),
      gate: 'ready',
      hasWriteNotes: true,
      account: ada,
    })
    expect(result.restoreVerses).toBeNull()
    expect(result.flow).toMatchObject({
      status: 'composing',
      draft: { account: ada, requestId: 'req-1', passageId: 'JHN.3.16-17+JHN.3.19' },
    })
  })

  it('does not start sign-in when auth is unconfigured', () => {
    const result = step({ status: 'idle' }, {
      type: 'start',
      draft: draft(),
      gate: 'unconfigured',
      hasWriteNotes: false,
      account: null,
    })
    expect(result.flow).toEqual({ status: 'idle' })
  })

  it('parks the draft until sign-in grants write_notes', () => {
    const parked = step({ status: 'idle' }, {
      type: 'start',
      draft: draft(),
      gate: 'signed-out',
      hasWriteNotes: false,
      account: null,
    })
    expect(parked.flow).toMatchObject({ status: 'needs-auth', attemptId: '' })

    const started = step(parked.flow, { type: 'begin-sign-in', attemptId: 'attempt-a' })
    const opened = step(started.flow, {
      type: 'sign-in-finished',
      attemptId: 'attempt-a',
      grantedWriteNotes: true,
      account: ada,
    })
    expect(opened.flow).toMatchObject({ status: 'composing', draft: { account: ada } })
  })

  it('ignores a sign-in result from an older attempt', () => {
    const parked = step({ status: 'idle' }, {
      type: 'start',
      draft: draft(),
      gate: 'signed-out',
      hasWriteNotes: false,
      account: null,
    })
    const first = step(parked.flow, { type: 'begin-sign-in', attemptId: 'attempt-a' })
    const cancelled = step(first.flow, { type: 'sign-in-cancelled', attemptId: 'attempt-a' })
    expect(cancelled.restoreVerses).toEqual([16, 17, 19])

    const again = step({ status: 'idle' }, {
      type: 'start',
      draft: draft({ requestId: 'req-9' }),
      gate: 'signed-out',
      hasWriteNotes: false,
      account: null,
    })
    const second = step(again.flow, { type: 'begin-sign-in', attemptId: 'attempt-b' })
    const stale = step(second.flow, {
      type: 'sign-in-finished',
      attemptId: 'attempt-a',
      grantedWriteNotes: true,
      account: ada,
    })
    expect(stale.flow).toMatchObject({ status: 'needs-auth', attemptId: 'attempt-b' })
    expect(stale.restoreVerses).toBeNull()
  })

  it('restores the selection when sign-in is declined', () => {
    const parked = step({ status: 'idle' }, {
      type: 'start',
      draft: draft({ account: ada }),
      gate: 'ready',
      hasWriteNotes: false,
      account: ada,
    })
    const started = step(parked.flow, { type: 'begin-sign-in', attemptId: 'attempt-a' })
    const declined = step(started.flow, {
      type: 'sign-in-finished',
      attemptId: 'attempt-a',
      grantedWriteNotes: false,
      account: ada,
    })
    expect(declined.flow).toEqual({ status: 'idle' })
    expect(declined.restoreVerses).toEqual([16, 17, 19])
  })

  it('keeps the request id on retry and replaces it when the draft changes', () => {
    const opened = step({ status: 'idle' }, {
      type: 'start',
      draft: draft({ account: ada }),
      gate: 'ready',
      hasWriteNotes: true,
      account: ada,
    })
    const saving = step(opened.flow, { type: 'save-started' })
    const failed = step(saving.flow, { type: 'save-failed', requestId: 'req-1' })
    expect(failed.flow).toMatchObject({
      status: 'composing',
      saving: false,
      saveError: true,
      draft: { requestId: 'req-1', text: '' },
    })

    const edited = step(failed.flow, { type: 'set-text', text: 'A note' })
    expect(edited.flow).toMatchObject({
      saveError: false,
      draft: { requestId: 'req-2', text: 'A note' },
    })

    const sameText = step(edited.flow, { type: 'set-text', text: 'A note' })
    expect(sameText.flow).toMatchObject({ draft: { requestId: 'req-2' } })

    const visibility = step(edited.flow, { type: 'set-visibility', visibility: 'public' })
    const color = step(visibility.flow, { type: 'set-color', color: 'ffec5b' })
    expect(color.flow).toMatchObject({
      draft: { requestId: 'req-4', visibility: 'public', color: 'ffec5b' },
    })
  })

  it('asks before discarding unsaved text, visibility, or color', () => {
    const opened = step({ status: 'idle' }, {
      type: 'start',
      draft: draft({ account: ada, text: 'Keep me' }),
      gate: 'ready',
      hasWriteNotes: true,
      account: ada,
    })
    if (opened.flow.status !== 'composing') {
      throw new Error('expected the composer')
    }
    expect(noteDraftIsDirty(opened.flow.draft)).toBe(true)
    const asking = step(opened.flow, { type: 'request-dismiss' })
    expect(asking.flow).toMatchObject({ status: 'composing', confirmDiscard: true })
    const kept = step(asking.flow, { type: 'keep-editing' })
    expect(kept.flow).toMatchObject({ confirmDiscard: false, draft: { text: 'Keep me' } })

    const clean = step({ status: 'idle' }, {
      type: 'start',
      draft: draft({ account: ada }),
      gate: 'ready',
      hasWriteNotes: true,
      account: ada,
    })
    expect(step(clean.flow, { type: 'request-dismiss' }).flow).toEqual({ status: 'idle' })
  })

  it('drops a bound draft when the account changes', () => {
    const opened = step({ status: 'idle' }, {
      type: 'start',
      draft: draft(),
      gate: 'ready',
      hasWriteNotes: true,
      account: ada,
    })
    expect(step(opened.flow, { type: 'account-changed', account: ada }).flow.status).toBe(
      'composing',
    )
    expect(step(opened.flow, { type: 'account-changed', account: grace }).flow).toEqual({
      status: 'idle',
    })
    expect(step(opened.flow, { type: 'account-changed', account: null }).flow).toEqual({
      status: 'idle',
    })
  })

  it('does not hand a bound draft to a different account', () => {
    const parked = step({ status: 'idle' }, {
      type: 'start',
      draft: draft({ account: ada }),
      gate: 'settling',
      hasWriteNotes: false,
      account: ada,
    })
    const switched = step(parked.flow, {
      type: 'auth-settled',
      gate: 'ready',
      hasWriteNotes: true,
      account: grace,
    })
    expect(switched.flow).toEqual({ status: 'idle' })
  })

  it('opens the composer when write_notes is granted and there is no user id', () => {
    const opened = step({ status: 'idle' }, {
      type: 'start',
      draft: draft(),
      gate: 'ready',
      hasWriteNotes: true,
      account: null,
    })
    expect(opened.flow.status).toBe('composing')
  })

  it('ignores a save result after a newer draft has replaced the one that was saving', () => {
    const opened = step({ status: 'idle' }, {
      type: 'start',
      draft: draft({ account: ada }),
      gate: 'ready',
      hasWriteNotes: true,
      account: ada,
    })
    const saving = step(opened.flow, { type: 'save-started' })
    const left = step(saving.flow, { type: 'left-passage' })
    const next = step(left.flow, {
      type: 'start',
      draft: draft({ account: ada, text: 'newer', requestId: 'req-new' }),
      gate: 'ready',
      hasWriteNotes: true,
      account: ada,
    })
    expect(step(next.flow, { type: 'save-succeeded', requestId: 'req-1' }).flow).toMatchObject({
      status: 'composing',
      draft: { text: 'newer', requestId: 'req-new' },
    })
    expect(step(next.flow, { type: 'save-failed', requestId: 'req-1' }).flow).toMatchObject({
      status: 'composing',
      saveError: false,
      draft: { text: 'newer' },
    })
  })

  it('keeps an unbound draft when an account appears', () => {
    const parked = step({ status: 'idle' }, {
      type: 'start',
      draft: draft(),
      gate: 'signed-out',
      hasWriteNotes: false,
      account: null,
    })
    expect(step(parked.flow, { type: 'account-changed', account: ada }).flow).toMatchObject({
      status: 'needs-auth',
      draft: { account: null },
    })
  })
})
