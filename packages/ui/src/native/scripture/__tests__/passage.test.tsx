import { fireEvent, render, screen } from '@testing-library/react-native'
import { Children, isValidElement } from 'react'
import { StyleSheet, Text } from 'react-native'
import type { ReactTestInstance } from 'react-test-renderer'

import en from '../../../i18n/locales/en.json'
import { LocaleProvider } from '../../../i18n/locale-context'
import { parsePassage, type Block } from '../parse-passage'
import {
  Passage,
  coverRects,
  sampleTop,
  smallCaps,
  tableColumnWidths,
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
  lineMultiple: 1.64,
  rtl: false,
  face: () => ({}),
  labelFace: {},
  ink: '#000000',
  label: '#636161',
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

/** End-aligned Selah sits in a full-width row pinned with flex-end (passage direction). */
function endEdgeJustifies(sentence: string): string[] {
  return screen.getAllByText(sentence).map((node) => {
    let current: ReactTestInstance | null = node
    while (current !== null) {
      const style = StyleSheet.flatten(current.props.style)
      if (style?.justifyContent !== undefined) {
        return String(style.justifyContent)
      }
      current = current.parent
    }
    throw new Error(`no justifyContent for ${sentence}`)
  })
}

/** Long pauses must shrink/wrap inside the reader column. */
function endEdgeShrinks(sentence: string): { flexShrink: number; maxWidth: string }[] {
  return screen.getAllByText(sentence).map((node) => {
    let current: ReactTestInstance | null = node
    while (current !== null) {
      const style = StyleSheet.flatten(current.props.style)
      if (style?.flexShrink === 1 && style.maxWidth !== undefined) {
        return { flexShrink: 1, maxWidth: String(style.maxWidth) }
      }
      current = current.parent
    }
    throw new Error(`no flexShrink/maxWidth for ${sentence}`)
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
        onVersePress={() => undefined}
        onNotePress={() => undefined}
        onBlockLayout={() => undefined}
        onBlockRef={() => undefined}
      />
    </LocaleProvider>,
  )
}

describe('paragraph alignment', () => {
  // textAlign is start-relative under RTL; see ADR 0023.
  it('starts an ordinary right-to-left paragraph at its start edge', () => {
    renderBlock(['p'], 'בראשית', true)
    expect(textAligns('בראשית')).toEqual(['left'])
  })

  it('starts right-to-left poetry at its start edge', () => {
    renderBlock(['q1'], 'בראשית', true)
    expect(textAligns('בראשית')).toEqual(['left'])
  })

  it('keeps an ordinary left-to-right paragraph on the left', () => {
    renderBlock(['p'], 'In the beginning', false)
    expect(textAligns('In the beginning')).toEqual(['left'])
  })

  it('keeps a centred line centred in a right-to-left passage', () => {
    renderBlock(['qc'], 'סלה', true)
    expect(textAligns('סלה')).toEqual(['center'])
  })

  it('sends an explicit right line to its end edge in a right-to-left passage', () => {
    renderBlock(['qr'], 'סלה', true)
    expect(textAligns('סלה')).toEqual(['right'])
  })

  it('pins a qs pause and its period to the end edge in a left-to-right passage', () => {
    const html =
      '<div><div class="q"><span class="yv-v" v="3"></span>the Holy One from the mountain. ' +
      '<span class="qs">Selah</span>.</div></div>'
    render(
      <LocaleProvider locale="en">
        <Passage
          blocks={parsePassage(html).blocks}
          look={{
            ...LOOK,
            face: (_weight, italic) => (italic ? { fontStyle: 'italic' } : {}),
          }}
          selected={new Set()}
          paint={new Map()}
          focus={null}
          onVersePress={() => undefined}
          onNotePress={() => undefined}
          onBlockLayout={() => undefined}
          onBlockRef={() => undefined}
        />
      </LocaleProvider>,
    )
    // Layout places the pause on the trailing edge; textAlign keeps a wrapped pause there.
    expect(endEdgeJustifies('Selah')).toEqual(['flex-end'])
    expect(endEdgeJustifies('.')).toEqual(['flex-end'])
    expect(textAligns('Selah')).toEqual(['right'])
    expect(textAligns('.')).toEqual(['right'])
    expect(endEdgeShrinks('Selah')).toEqual([{ flexShrink: 1, maxWidth: '100%' }])
    const selah = screen.getByText('Selah')
    expect(StyleSheet.flatten(selah.props.style)?.fontStyle).toBe('italic')
  })

  it('pins a qs pause to the end edge in a right-to-left passage', () => {
    const html = '<div><div class="q"><span class="qs">סלה</span></div></div>'
    render(
      <LocaleProvider locale="en">
        <Passage
          blocks={parsePassage(html).blocks}
          look={{ ...LOOK, rtl: true }}
          selected={new Set()}
          paint={new Map()}
          focus={null}
          onVersePress={() => undefined}
          onNotePress={() => undefined}
          onBlockLayout={() => undefined}
          onBlockRef={() => undefined}
        />
      </LocaleProvider>,
    )
    // flex-end under passage direction:rtl and start-relative 'right' both land physically
    // left, so a wrapped pause stays on the trailing edge.
    expect(endEdgeJustifies('סלה')).toEqual(['flex-end'])
    expect(textAligns('סלה')).toEqual(['right'])
    expect(endEdgeShrinks('סלה')).toEqual([{ flexShrink: 1, maxWidth: '100%' }])
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
          onVersePress={() => undefined}
          onNotePress={() => undefined}
          onBlockLayout={() => undefined}
          onBlockRef={() => undefined}
        />
      </LocaleProvider>,
    )
    expect(screen.getByLabelText('Footnote')).toBeTruthy()
  })
})

describe('verse labels', () => {
  /**
   * Each text run's own children in reading order, with each footnote button as `[note]`.
   * A paragraph's leading anchor is also a word joiner; it reads as `[anchor]`.
   */
  function readingOrder(): unknown[] {
    const insideText = (node: ReactTestInstance): boolean =>
      node.parent !== null && (node.parent.type === Text || insideText(node.parent))
    const ownText = (node: ReactTestInstance): unknown[] =>
      Children.toArray(node.props.children).flatMap((child, i) =>
        isValidElement(child)
          ? []
          : [i === 0 && child === '⁠' && !insideText(node) ? '[anchor]' : child],
      )
    const labelled = (node: ReactTestInstance | null): boolean =>
      node?.props.accessibilityLabel === en.footnoteAriaLabel
    // The outermost labelled node, so the button and the view it renders count once.
    const isNote = (node: ReactTestInstance): boolean => labelled(node) && !labelled(node.parent)
    return screen.root
      .findAll((node) => isNote(node) || node.type === Text)
      .flatMap((node) => (isNote(node) ? ['[note]'] : ownText(node)))
  }

  /** The runs either side of each word joiner. */
  function joinerNeighbours(): unknown[][] {
    const order = readingOrder()
    return order.flatMap((run, i) => (run === '\u2060' ? [[order[i - 1], order[i + 1]]] : []))
  }

  it('joins a verse label to its first word so a line cannot end on the label', () => {
    const html =
      '<div><div class="p"><span class="yv-v" v="7"></span><span class="yv-vlbl">7</span>his god. ' +
      '<span class="yv-v" v="8"></span><span class="yv-vlbl">8</span>Cyrus king</div></div>'
    render(
      <LocaleProvider locale="en">
        <Passage
          blocks={parsePassage(html).blocks}
          look={LOOK}
          selected={new Set()}
          paint={new Map()}
          focus={null}
          onVersePress={() => undefined}
          onNotePress={() => undefined}
          onBlockLayout={() => undefined}
          onBlockRef={() => undefined}
        />
      </LocaleProvider>,
    )
    // Each label, then its joiner, then its first word.
    expect(joinerNeighbours()).toEqual([
      ['7', 'his god.'],
      ['8', 'Cyrus king'],
    ])
  })

  it('joins a note marker to the word before it', () => {
    const html =
      '<div><div class="p"><span class="yv-v" v="14"></span><span class="yv-vlbl">14</span>' +
      'to Jesarelah,<span class="yv-n f"><span class="ft">Or Asarelah</span></span></div></div>'
    render(
      <LocaleProvider locale="en">
        <Passage
          blocks={parsePassage(html).blocks}
          look={LOOK}
          selected={new Set()}
          paint={new Map()}
          focus={null}
          onVersePress={() => undefined}
          onNotePress={() => undefined}
          onBlockLayout={() => undefined}
          onBlockRef={() => undefined}
        />
      </LocaleProvider>,
    )
    // The label's joiner leads its word; the note's sits between the word and the note.
    expect(joinerNeighbours()).toEqual([
      ['14', 'to Jesarelah,'],
      ['to Jesarelah,', '[note]'],
    ])
  })
})

describe('tableColumnWidths', () => {
  it('waits until every later column is measured', () => {
    expect(tableColumnWidths(300, [undefined, 120], 3, 15)).toBeNull()
  })

  it('keeps natural widths that fit', () => {
    expect(tableColumnWidths(300, [undefined, 100, 50], 3, 15)).toEqual([100, 50])
  })

  it('caps a wide middle column at an even share so column 0 keeps the rest', () => {
    // 330 - 2 gaps - 60 = 240 left; the middle column and column 0 split it.
    expect(tableColumnWidths(330, [undefined, 400, 60], 3, 15)).toEqual([120, 60])
  })

  it('serves the narrowest middle column first and passes its slack on', () => {
    // 370 - 3 gaps - 25 = 300: the 40 column takes 40, the wide one 130, column 0 130.
    expect(tableColumnWidths(370, [undefined, 500, 40, 25], 4, 15)).toEqual([130, 40, 25])
  })

  it('gives a two-column table its trailing width', () => {
    expect(tableColumnWidths(300, [undefined, 80], 2, 15)).toEqual([80])
  })
})

describe('table columns', () => {
  function cell(text: string, col: number): Block {
    return { ...block(['tc'], text), table: { id: 0, row: 0, col, columns: 2 } }
  }

  function renderTable(blocks: Block[]): ReturnType<typeof render> {
    return render(
      <LocaleProvider locale="en">
        <Passage
          blocks={blocks}
          look={LOOK}
          selected={new Set()}
          paint={new Map()}
          focus={null}
          onVersePress={() => undefined}
          onNotePress={() => undefined}
        />
      </LocaleProvider>,
    )
  }

  /** The count cell's column view, which takes the measured width. */
  function countColumn(): ReactTestInstance {
    let current: ReactTestInstance | null = screen.getByText('12')
    while (current !== null) {
      if (StyleSheet.flatten(current.props.style)?.marginStart !== undefined) {
        return current
      }
      current = current.parent
    }
    throw new Error('no count column')
  }

  function measurer(): ReactTestInstance {
    const [found] = countColumn().findAll((node) => node.props.onLayout !== undefined)
    if (found === undefined) throw new Error('no measurer')
    return found
  }

  function measureCount(width: number): void {
    fireEvent(measurer(), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height: 20 } } })
  }

  function rerenderTable(
    view: ReturnType<typeof render>,
    blocks: Block[],
    look: PassageLook,
  ): void {
    view.rerender(
      <LocaleProvider locale="en">
        <Passage
          blocks={blocks}
          look={look}
          selected={new Set()}
          paint={new Map()}
          focus={null}
          onVersePress={() => undefined}
          onNotePress={() => undefined}
        />
      </LocaleProvider>,
    )
  }

  it('keeps a column and its measurer while the cells and look stay put', () => {
    const blocks = [cell('his sons', 0), cell('12', 1)]
    const view = renderTable(blocks)
    measureCount(20)
    const before = measurer()
    rerenderTable(view, blocks, LOOK)
    expect(measurer()).toBe(before)
    expect(StyleSheet.flatten(countColumn().props.style).width).toBe(20)
  })

  // onLayout fires only on a changed frame, so a reset must remount the measurer:
  // the widest cell's frame often stays the same and would never report again.
  it.each([
    ['new cells (a note restored)', [cell('his sons', 0), cell('12', 1)], LOOK],
    ['a new look (a theme switch)', null, { ...LOOK, ink: '#111111' }],
  ])('measures a column again from a fresh measurer after %s', (_, next, look) => {
    const blocks = [cell('his sons', 0), cell('12', 1)]
    const view = renderTable(blocks)
    measureCount(20)
    const before = measurer()
    rerenderTable(view, next ?? blocks, look)
    expect(measurer()).not.toBe(before)
    expect(StyleSheet.flatten(countColumn().props.style).width).toBeUndefined()
    measureCount(34)
    expect(StyleSheet.flatten(countColumn().props.style).width).toBe(34)
  })

  // A shrink-wrapped cell can round a fraction under its text; a ghost at the cell's
  // width then wraps ("2,172" as "2,17" / "2") and its fill misses the line window.
  it('lays a painted cell ghost out at the real text width', () => {
    const count: Block = {
      ...cell('2,172', 1),
      verses: [3],
      segments: [{ verse: 3, inlines: [{ kind: 'text', text: '2,172', classes: [] }] }],
    }
    render(
      <LocaleProvider locale="en">
        <Passage
          blocks={[cell('of Parosh', 0), count]}
          look={LOOK}
          selected={new Set()}
          paint={new Map([[3, { background: '#ffff00', text: null }]])}
          focus={null}
          onVersePress={() => undefined}
          onNotePress={() => undefined}
        />
      </LocaleProvider>,
    )
    const paragraphs = (): ReactTestInstance[] =>
      screen.getAllByText('2,172', { includeHiddenElements: true }).map((node) => {
        let current: ReactTestInstance | null = node
        while (
          current !== null &&
          StyleSheet.flatten(current.props.style)?.textAlign === undefined
        ) {
          current = current.parent
        }
        if (current === null) throw new Error('no paragraph')
        return current
      })
    const [real] = paragraphs()
    if (real === undefined) throw new Error('no real paragraph')
    const line = {
      text: '2,172',
      x: 0,
      y: 0,
      width: 41.27,
      height: 30,
      descender: 8,
      capHeight: 12,
      ascender: 21,
      xHeight: 8,
    }
    fireEvent(real, 'textLayout', { nativeEvent: { lines: [line] } })
    fireEvent(real, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 44.87, height: 30 } } })
    const ghostWidths = paragraphs()
      .filter((node) => node.props.onLayout === undefined)
      .map((node) => StyleSheet.flatten(node.props.style).width)
    expect(ghostWidths.length).toBeGreaterThan(0)
    expect(new Set(ghostWidths)).toEqual(new Set([44.87]))
  })
})
