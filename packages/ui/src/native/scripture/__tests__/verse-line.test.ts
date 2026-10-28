import { parsePassage } from '../parse-passage'
import { focusLineBox, focusScrollOffset, verseLineBoxes } from '../verse-line'

const TWO_VERSES =
  '<div><div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>' +
  'In the beginning <span class="yv-v" v="2"></span><span class="yv-vlbl">2</span>He was with God</div></div>'

function blockOf(html: string) {
  const block = parsePassage(html).blocks[0]
  if (block === undefined) {
    throw new Error('expected a block')
  }
  return block
}

describe('verseLineBoxes', () => {
  it('uses the later verse line when the paragraph wraps', () => {
    const block = blockOf(TWO_VERSES)
    const boxes = verseLineBoxes(
      [
        { text: 'In the beginning ', y: 0, height: 32 },
        { text: 'He was with God', y: 480, height: 32 },
      ],
      block,
      false,
    )

    expect(boxes?.get(2)).toEqual({ y: 480, height: 32 })
  })

  it('covers every line a verse wraps across', () => {
    const block = blockOf(
      '<div><div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>In the beginning God created</div></div>',
    )
    const boxes = verseLineBoxes(
      [
        { text: 'In the beginning ', y: 10, height: 20 },
        { text: 'God created', y: 30, height: 20 },
      ],
      block,
      false,
    )

    expect(boxes?.get(1)).toEqual({ y: 10, height: 40 })
  })

  it('finds a small-caps verse by the capitals on the line', () => {
    const block = blockOf(
      '<div><div class="pc"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>Lord</div></div>',
    )
    const boxes = verseLineBoxes([{ text: 'LORD', y: 4, height: 18 }], block, true)

    expect(boxes?.get(1)).toEqual({ y: 4, height: 18 })
  })

  it('keeps a footnote from hiding the verse that follows it', () => {
    const block = blockOf(
      '<div><div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>' +
        'Let Israel<span class="yv-n f"><span class="ft">Or now</span></span> say,' +
        '<span class="yv-v" v="2"></span><span class="yv-vlbl">2</span>He was</div></div>',
    )
    const boxes = verseLineBoxes(
      [
        { text: 'Let Israel\uFFFC say,', y: 0, height: 24 },
        { text: 'He was', y: 200, height: 24 },
      ],
      block,
      false,
    )

    expect(boxes?.get(2)).toEqual({ y: 200, height: 24 })
  })

  it('returns null when the lines do not contain the verse', () => {
    const block = blockOf(TWO_VERSES)
    expect(verseLineBoxes([{ text: 'something else', y: 0, height: 20 }], block, false)).toBeNull()
  })

  it('joins a verse that continues later in the same paragraph', () => {
    const block = blockOf(
      '<div><div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>Blessed</div></div>',
    )
    const boxes = verseLineBoxes(
      [
        { text: 'Blessed', y: 0, height: 20 },
        { text: 'are those', y: 20, height: 20 },
      ],
      {
        ...block,
        segments: [
          ...block.segments,
          { verse: 1, inlines: [{ kind: 'text', text: 'are those', classes: [] }] },
        ],
      },
      false,
    )

    expect(boxes?.get(1)).toEqual({ y: 0, height: 40 })
  })
})

describe('focusLineBox', () => {
  it('spans from the first requested verse to the last one in the paragraph', () => {
    const box = focusLineBox(
      new Map([
        [1, { y: 0, height: 20 }],
        [2, { y: 40, height: 20 }],
        [3, { y: 80, height: 20 }],
      ]),
      [2, 3],
    )

    expect(box).toEqual({ y: 40, height: 60 })
  })
})

describe('focusScrollOffset', () => {
  it('centers a box that fits on screen', () => {
    expect(focusScrollOffset(416, 32, 200, 16)).toBe(416 + 16 - 100)
  })

  it('pins a box taller than the screen under the top padding', () => {
    expect(focusScrollOffset(16, 800, 200, 16)).toBe(0)
  })

  it('does not scroll above the chapter', () => {
    expect(focusScrollOffset(0, 20, 200, 16)).toBe(0)
  })
})
