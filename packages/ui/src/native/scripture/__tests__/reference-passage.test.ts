import type { Block } from '../parse-passage'
import {
  scripturePhase,
  verseSpanFromPassageId,
  type ScripturePhaseInput,
} from '../reference-passage'
import { passageKey, type LoadedPassage } from '../use-passage'

function block(verse: number, text: string, heading = false): Block {
  return {
    classes: heading ? ['s'] : ['p'],
    heading,
    segments: [{ verse: heading ? null : verse, inlines: [{ kind: 'text', text, classes: [] }] }],
    verses: heading ? [] : [verse],
  }
}

function loaded(blocks: Block[], chapter = '3'): LoadedPassage {
  return {
    key: passageKey(111, 'JHN', chapter),
    versionId: 111,
    book: 'JHN',
    chapter,
    parsed: { blocks, verses: new Map(), rtl: false },
    reference: 'John 3',
  }
}

function input(overrides: Partial<ScripturePhaseInput> = {}): ScripturePhaseInput {
  return {
    span: verseSpanFromPassageId('JHN.3.16'),
    versionId: 111,
    refused: false,
    awaitingLanguage: false,
    versionLookupBlocked: false,
    versionError: null,
    passage: loaded([block(16, 'For God so loved'), block(17, 'For God did not')]),
    loading: false,
    error: null,
    ...overrides,
  }
}

describe('verseSpanFromPassageId', () => {
  it('keeps a verse range and a single verse', () => {
    expect(verseSpanFromPassageId('JHN.3.16-18')).toEqual({
      book: 'JHN',
      chapter: '3',
      verses: { start: 16, end: 18 },
    })
    expect(verseSpanFromPassageId('JHN.3.16')).toEqual({
      book: 'JHN',
      chapter: '3',
      verses: { start: 16, end: 16 },
    })
  })

  it('treats a chapter id as the whole chapter', () => {
    expect(verseSpanFromPassageId('PSA.23')).toEqual({
      book: 'PSA',
      chapter: '23',
      verses: null,
    })
  })

  it('rejects a reversed range and a non-usfm id', () => {
    expect(verseSpanFromPassageId('JHN.3.18-16')).toBeNull()
    expect(verseSpanFromPassageId('not-usfm')).toBeNull()
  })
})

describe('scripturePhase', () => {
  it('shows only the requested verse and its text', () => {
    const phase = scripturePhase(input())
    expect(phase.kind).toBe('passage')
    if (phase.kind !== 'passage') {
      return
    }
    expect(phase.blocks).toHaveLength(1)
    expect(phase.blocks[0]?.segments[0]?.inlines[0]).toMatchObject({ text: 'For God so loved' })
  })

  it('keeps every verse in a range and drops the chapter heading', () => {
    const phase = scripturePhase(
      input({
        span: verseSpanFromPassageId('JHN.3.16-17'),
        passage: loaded([
          block(0, 'God so loved', true),
          block(16, 'For God so loved'),
          block(17, 'For God did not'),
          block(18, 'Whoever believes'),
        ]),
      }),
    )
    expect(phase.kind).toBe('passage')
    if (phase.kind !== 'passage') {
      return
    }
    const text = phase.blocks.flatMap((item) =>
      item.segments.flatMap((segment) =>
        segment.inlines.map((inline) => (inline.kind === 'text' ? inline.text : '')),
      ),
    )
    expect(text).toEqual(['For God so loved', 'For God did not'])
  })

  it('keeps headings for a whole chapter', () => {
    const phase = scripturePhase(
      input({
        span: verseSpanFromPassageId('JHN.3'),
        passage: loaded([block(0, 'God so loved', true), block(16, 'For God so loved')]),
      }),
    )
    expect(phase.kind).toBe('passage')
    if (phase.kind !== 'passage') {
      return
    }
    expect(phase.blocks).toHaveLength(2)
  })

  it('reports an invalid reference or a refused version as unavailable, with no retry', () => {
    expect(scripturePhase(input({ span: null })).kind).toBe('unavailable')
    expect(scripturePhase(input({ refused: true })).kind).toBe('unavailable')
  })

  it('waits while the language tag is in flight', () => {
    expect(scripturePhase(input({ awaitingLanguage: true })).kind).toBe('loading')
  })

  it('maps a blocked version lookup to offline or failed, with a version retry', () => {
    expect(scripturePhase(input({ versionLookupBlocked: true, versionError: 'offline' }))).toEqual({
      kind: 'offline',
      retry: 'version',
    })
    expect(scripturePhase(input({ versionLookupBlocked: true, versionError: 'failed' }))).toEqual({
      kind: 'failed',
      retry: 'version',
    })
  })

  it('maps passage errors and leaves unavailable without a retry', () => {
    expect(scripturePhase(input({ error: 'offline' }))).toEqual({
      kind: 'offline',
      retry: 'passage',
    })
    expect(scripturePhase(input({ error: 'failed' }))).toEqual({ kind: 'failed', retry: 'passage' })
    expect(scripturePhase(input({ error: 'unavailable' })).kind).toBe('unavailable')
  })

  it('shows a loader until the requested chapter is the one in hand', () => {
    expect(scripturePhase(input({ passage: null })).kind).toBe('loading')
    expect(
      scripturePhase(input({ passage: loaded([block(1, 'In the beginning')], '1') })).kind,
    ).toBe('loading')
  })

  it('reports a loaded chapter that does not contain the verse as unavailable', () => {
    expect(scripturePhase(input({ passage: loaded([block(1, 'In the beginning')]) })).kind).toBe(
      'unavailable',
    )
  })
})
