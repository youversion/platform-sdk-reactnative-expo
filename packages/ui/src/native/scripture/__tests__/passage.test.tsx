import { render, screen } from '@testing-library/react-native'
import { isValidElement } from 'react'
import { StyleSheet } from 'react-native'
import type { ReactTestInstance } from 'react-test-renderer'

import type { Block } from '../parse-passage'
import {
  Passage,
  coverRects,
  sampleTop,
  smallCaps,
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
    <Passage
      blocks={[block(classes, text)]}
      look={{ ...LOOK, rtl }}
      selected={new Set()}
      paint={new Map()}
      focus={null}
      onVersePress={() => undefined}
      onNotePress={() => undefined}
      onBlockLayout={() => undefined}
      onBlockRef={() => undefined}
    />,
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
})
