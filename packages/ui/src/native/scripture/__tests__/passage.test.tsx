import { isValidElement } from 'react'

import { coverRects, sampleTop, smallCaps, type LineWindow } from '../passage'

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
})

describe('sampleTop', () => {
  it('uses the natural top when the band stays inside the line box', () => {
    expect(sampleTop({ y: 10, height: 20 }, 12, 8)).toBe(12)
  })

  it('does not use the natural top when the band extends past the line box', () => {
    expect(sampleTop({ y: 10, height: 10 }, 8, 16)).toBe(7)
  })
})
