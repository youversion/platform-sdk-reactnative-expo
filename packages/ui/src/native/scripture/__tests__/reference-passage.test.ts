import type { Block } from '../parse-passage'
import {
  blocksInSpan,
  scripturePhase,
  verseSpanFromPassageId,
  type ScripturePhaseInput,
} from '../reference-passage'
import { chapterRef, passageKey, passageRefFor, type LoadedPassage } from '../use-passage'

function block(verse: number, text: string, heading = false): Block {
  return {
    classes: heading ? ['s'] : ['p'],
    heading,
    segments: [{ verse: heading ? null : verse, inlines: [{ kind: 'text', text, classes: [] }] }],
    verses: heading ? [] : [verse],
  }
}

function loaded(blocks: Block[], usfm = 'JHN.3.16'): LoadedPassage {
  const ref = passageRefFor(usfm) ?? chapterRef('JHN', '3')
  return {
    ...ref,
    key: passageKey(111, ref),
    versionId: 111,
    parsed: { blocks, verses: new Map(), rtl: false },
    reference: 'John 3',
  }
}

function addressFor(span: NonNullable<ScripturePhaseInput['span']>) {
  if (span.verses === null) {
    return passageRefFor(`${span.book}.${span.chapter}`) ?? chapterRef(span.book, span.chapter)
  }
  const verse =
    span.verses.end === span.verses.start
      ? `${span.verses.start}`
      : `${span.verses.start}-${span.verses.end}`
  return (
    passageRefFor(`${span.book}.${span.chapter}.${verse}`) ?? chapterRef(span.book, span.chapter)
  )
}

function input(overrides: Partial<ScripturePhaseInput> = {}): ScripturePhaseInput {
  const span = overrides.span !== undefined ? overrides.span : verseSpanFromPassageId('JHN.3.16')
  const address =
    overrides.address !== undefined
      ? overrides.address
      : span === null
        ? null
        : addressFor(span)
  const defaultUsfm = address?.usfm ?? 'JHN.3.16'
  return {
    span,
    versionId: 111,
    gate: 'open',
    address,
    versionError: null,
    passage: loaded([block(16, 'For God so loved'), block(17, 'For God did not')], defaultUsfm),
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

  it('treats a catalog introduction as the whole chapter', () => {
    expect(verseSpanFromPassageId('GEN.INTRO')).toEqual({
      book: 'GEN',
      chapter: 'INTRO',
      verses: null,
    })
    expect(verseSpanFromPassageId('JHN.INTRO')).toEqual({
      book: 'JHN',
      chapter: 'INTRO',
      verses: null,
    })
  })

  it('rejects a reversed range and a non-usfm id', () => {
    expect(verseSpanFromPassageId('JHN.3.18-16')).toBeNull()
    expect(verseSpanFromPassageId('not-usfm')).toBeNull()
  })
})

describe('blocksInSpan', () => {
  it('returns the same sliced blocks for the same chapter and span', () => {
    const chapter = [block(16, 'For God so loved'), block(17, 'For God did not')]
    const span = { book: 'JHN', chapter: '3', verses: { start: 16, end: 16 } }
    const first = blocksInSpan(chapter, span)
    expect(blocksInSpan(chapter, { ...span, verses: { start: 16, end: 16 } })).toBe(first)
    expect(blocksInSpan(chapter, { ...span, verses: { start: 16, end: 17 } })).not.toBe(first)
    expect(blocksInSpan([...chapter], span)).not.toBe(first)
  })

  it('returns the chapter blocks themselves for a whole chapter', () => {
    const chapter = [block(16, 'For God so loved')]
    expect(blocksInSpan(chapter, { book: 'JHN', chapter: '3', verses: null })).toBe(chapter)
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
        passage: loaded(
          [
            block(0, 'God so loved', true),
            block(16, 'For God so loved'),
            block(17, 'For God did not'),
            block(18, 'Whoever believes'),
          ],
          'JHN.3.16-17',
        ),
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
        passage: loaded(
          [block(0, 'God so loved', true), block(16, 'For God so loved')],
          'JHN.3',
        ),
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
    expect(scripturePhase(input({ gate: 'refused' })).kind).toBe('unavailable')
  })

  it('waits while the language tag is in flight', () => {
    expect(scripturePhase(input({ gate: 'checking' })).kind).toBe('loading')
  })

  it('maps a blocked version lookup to offline or failed, with a version retry', () => {
    expect(scripturePhase(input({ gate: 'lookupFailed', versionError: 'offline' }))).toEqual({
      kind: 'offline',
      retry: 'version',
    })
    expect(scripturePhase(input({ gate: 'lookupFailed', versionError: 'failed' }))).toEqual({
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
      scripturePhase(input({ passage: loaded([block(1, 'In the beginning')], 'JHN.1') })).kind,
    ).toBe('loading')
  })

  it('reports a loaded chapter that does not contain the verse as unavailable', () => {
    expect(scripturePhase(input({ passage: loaded([block(1, 'In the beginning')]) })).kind).toBe(
      'unavailable',
    )
  })
})
