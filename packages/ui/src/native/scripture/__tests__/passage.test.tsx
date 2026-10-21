import { render, screen } from '@testing-library/react-native'
import { isValidElement } from 'react'
import { StyleSheet } from 'react-native'
import type { ReactTestInstance } from 'react-test-renderer'

import { LocaleProvider } from '../../../i18n/locale-context'
import type { Block } from '../parse-passage'
import {
  Passage,
  coverRects,
  sampleTop,
  smallCaps,
  verseSpan,
  type LineWindow,
  type PassageLook,
} from '../passage'

type RunProps = { style: { fontSize: number; letterSpacing: number }; children: string }

describe('smallCaps', () => {
  it('uppercases lowercase runs into smaller, tracked nested text', () => {
    const [lead, run] = smallCaps('Lord', 20)
    expect(lead).toBe('L')
    if (!isValidElement<RunProps>(run)) throw new Error('expected a nested small-cap run')
    expect(run.props.children).toBe('ORD')
    expect(run.props.style.fontSize).toBeCloseTo(17)
    expect(run.props.style.letterSpacing).toBeCloseTo(1.1)
    expect(run.props.style).not.toHaveProperty('lineHeight')
  })

  it('leaves capitals, spaces, and punctuation at full size', () => {
    const runs = smallCaps('the LORD, God', 20)
    expect(runs.filter((run) => !isValidElement(run))).toEqual([' LORD, G'])
  })
})

type Line = Parameters<typeof verseSpan>[2][number]

// Lines 30pt apart with the glyph band centred; only y and text matter to the span.
function line(index: number, text: string): Line {
  return {
    x: 0,
    y: index * 30,
    width: 100,
    height: 30,
    ascender: 20,
    descender: -6,
    capHeight: 14,
    xHeight: 10,
    text,
  }
}

describe('verseSpan', () => {
  const twoVerses: Block = {
    classes: ['p'],
    heading: false,
    verses: [1, 2],
    segments: [
      {
        verse: 1,
        inlines: [
          { kind: 'label', text: '1' },
          { kind: 'text', text: 'In the beginning ', classes: [] },
        ],
      },
      {
        verse: 2,
        inlines: [
          { kind: 'label', text: '2' },
          { kind: 'text', text: 'the earth was formless.', classes: [] },
        ],
      },
    ],
  }
  // Anchor and label are one character each; verse 1 ends mid-line 1, verse 2 wraps to line 2.
  const lines = [
    line(0, '\u200b\ufffcIn the '),
    line(1, 'beginning \ufffcthe earth '),
    line(2, 'was formless.'),
  ]

  it('spans only the lines that hold the verse', () => {
    const first = verseSpan(twoVerses, 1, lines, false, 20)
    const second = verseSpan(twoVerses, 2, lines, false, 20)
    if (first === null || second === null) throw new Error('expected spans')
    expect(first.top).toBeLessThan(30)
    expect(first.top + first.height).toBeLessThan(60)
    expect(second.top).toBeGreaterThan(30)
    expect(second.top + second.height).toBeGreaterThan(60)
  })

  it('does not reach the next line for a trailing space that wrapped', () => {
    const wrapped = [
      line(0, '\u200b\ufffcIn the beginning'),
      line(1, ' \ufffcthe earth was formless.'),
    ]
    const span = verseSpan(twoVerses, 1, wrapped, false, 20)
    if (span === null) throw new Error('expected a span')
    expect(span.top + span.height).toBeLessThan(30)
  })

  it('spans the whole block when the line text does not add up', () => {
    const short = [line(0, 'In the'), line(1, 'formless.')]
    const span = verseSpan(twoVerses, 2, short, false, 20)
    const whole = verseSpan(twoVerses, 1, short, false, 20)
    expect(span).toEqual(whole)
  })

  it('is null before the lines are measured', () => {
    expect(verseSpan(twoVerses, 1, [], false, 20)).toBeNull()
  })
})

function windowAt(left: number, top: number, width: number, height: number): LineWindow {
  return { left, top, width, height, sample: top }
}

describe('coverRects', () => {
  it('covers the box around two stacked windows', () => {
    expect(
      coverRects({ width: 100, height: 100 }, [windowAt(10, 10, 80, 20), windowAt(10, 40, 80, 20)]),
    ).toEqual([
      { x: 0, y: 0, width: 100, height: 10 },
      { x: 0, y: 30, width: 100, height: 10 },
      { x: 0, y: 60, width: 100, height: 40 },
      { x: 0, y: 10, width: 10, height: 20 },
      { x: 90, y: 10, width: 10, height: 20 },
      { x: 0, y: 40, width: 10, height: 20 },
      { x: 90, y: 40, width: 10, height: 20 },
    ])
  })

  it('omits side covers when a window is flush with both edges', () => {
    expect(coverRects({ width: 100, height: 50 }, [windowAt(0, 10, 100, 20)])).toEqual([
      { x: 0, y: 0, width: 100, height: 10 },
      { x: 0, y: 30, width: 100, height: 20 },
    ])
  })

  it('omits a zero-height gap between adjacent windows', () => {
    expect(
      coverRects({ width: 100, height: 80 }, [windowAt(10, 10, 80, 20), windowAt(10, 30, 80, 20)]),
    ).toEqual([
      { x: 0, y: 0, width: 100, height: 10 },
      { x: 0, y: 50, width: 100, height: 30 },
      { x: 0, y: 10, width: 10, height: 20 },
      { x: 90, y: 10, width: 10, height: 20 },
      { x: 0, y: 30, width: 10, height: 20 },
      { x: 90, y: 30, width: 10, height: 20 },
    ])
  })

  it('overlaps side covers and the last cover by the seam, leaving the window open', () => {
    expect(coverRects({ width: 100, height: 50 }, [windowAt(10, 10, 80, 20)], 1)).toEqual([
      { x: 0, y: 0, width: 100, height: 10 },
      { x: 0, y: 30, width: 100, height: 21 },
      { x: 0, y: 9, width: 10, height: 22 },
      { x: 90, y: 9, width: 10, height: 22 },
    ])
  })
})

describe('sampleTop', () => {
  it('uses the natural top when the band stays inside the line box', () => {
    expect(sampleTop({ y: 10, height: 20 }, 12, 8)).toBe(12)
  })

  it('does not use the natural top when the band extends past the line box', () => {
    expect(sampleTop({ y: 10, height: 10 }, 8, 16)).toBe(7)
  })
})

const LOOK: PassageLook = {
  fontSize: 20,
  lineSpacing: 1.7,
  rtl: false,
  face: () => ({}),
  labelFace: {},
  ink: '#000000',
  wj: '#ff0000',
  underline: '#cccccc',
  background: '#ffffff',
}

function block(classes: string[], text: string): Block {
  return {
    classes,
    heading: false,
    verses: [],
    segments: [{ verse: null, inlines: [{ kind: 'text', text, classes: [] }] }],
  }
}

function textAligns(sentence: string): string[] {
  return screen.getAllByText(sentence).map((node) => {
    let current: ReactTestInstance | null = node
    while (current !== null) {
      const align = StyleSheet.flatten(current.props.style)?.textAlign
      if (align !== undefined) {
        return align
      }
      current = current.parent
    }
    throw new Error(`no textAlign for ${sentence}`)
  })
}

function renderBlock(classes: string[], text: string, rtl: boolean): void {
  render(
    <LocaleProvider locale="en">
      <Passage
        blocks={[block(classes, text)]}
        look={{ ...LOOK, rtl }}
        selected={new Set()}
        paint={new Map()}
        focus={null}
        spokenVerse={null}
        onVersePress={() => undefined}
        onNotePress={() => undefined}
        onBlockLayout={() => undefined}
        onBlockRef={() => undefined}
        onSpokenLayout={() => undefined}
      />
    </LocaleProvider>,
  )
}

describe('paragraph alignment', () => {
  it('starts an ordinary right-to-left paragraph on the right', () => {
    renderBlock(['p'], 'בראשית', true)
    expect(textAligns('בראשית')).toEqual(['right'])
  })

  it('keeps an ordinary left-to-right paragraph on the left', () => {
    renderBlock(['p'], 'In the beginning', false)
    expect(textAligns('In the beginning')).toEqual(['left'])
  })

  it('keeps a centred line centred in a right-to-left passage', () => {
    renderBlock(['qc'], 'סלה', true)
    expect(textAligns('סלה')).toEqual(['center'])
  })

  it('keeps an explicit right line on the right in a right-to-left passage', () => {
    renderBlock(['qr'], 'סלה', true)
    expect(textAligns('סלה')).toEqual(['right'])
  })

  it('names the footnote button with the shared label', () => {
    render(
      <LocaleProvider locale="en">
        <Passage
          blocks={[
            {
              classes: ['p'],
              heading: false,
              verses: [1],
              segments: [{ verse: 1, inlines: [{ kind: 'note', html: '<span>Or</span>' }] }],
            },
          ]}
          look={LOOK}
          selected={new Set()}
          paint={new Map()}
          focus={null}
          spokenVerse={null}
          onVersePress={() => undefined}
          onNotePress={() => undefined}
          onBlockLayout={() => undefined}
          onBlockRef={() => undefined}
          onSpokenLayout={() => undefined}
        />
      </LocaleProvider>,
    )
    expect(screen.getByLabelText('Footnote')).toBeTruthy()
  })
})
