import { parseNoteHtml, parsePassage, type Block } from '../parse-passage'
import { resolveBlock } from '../styles'

function lineTexts(block: Block): string[] {
  return block.segments.flatMap((segment) =>
    segment.inlines.flatMap((inline) => (inline.kind === 'text' ? [inline.text] : [])),
  )
}

function lineKinds(block: Block): string[] {
  return block.segments.flatMap((segment) => segment.inlines.map((inline) => inline.kind))
}

describe('parsePassage', () => {
  it('drops the chapter label block', () => {
    const html =
      '<div><div class="cl">Psalm 119</div>' +
      '<div class="q1"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>Blessed are those</div></div>'
    const { blocks } = parsePassage(html)
    expect(blocks.map((block) => block.classes)).toEqual([['q1']])
  })

  it('sets a footnote against the word before it', () => {
    const html =
      '<div><div class="q1"><span class="yv-v" v="2"></span><span class="yv-vlbl">2</span>' +
      'Let Israel<span class="yv-n f"><span class="ft">Or Let Israel now</span></span>say,</div></div>'
    const { blocks } = parsePassage(html)
    const inlines = blocks[0]?.segments.flatMap((segment) => segment.inlines) ?? []
    const texts = inlines.flatMap((inline) => (inline.kind === 'text' ? [inline.text] : []))
    expect(texts).toEqual(['Let Israel', ' say,'])
    expect(inlines.map((inline) => inline.kind)).toEqual(['label', 'text', 'note', 'text'])
  })

  it('keeps the space between a verse-final footnote and the next verse label', () => {
    const html =
      '<div><div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>' +
      'In the beginning. <span class="yv-n f"><span class="ft">Or At first</span></span>' +
      '<span class="yv-v" v="2"></span><span class="yv-vlbl">2</span>He was</div></div>'
    const { blocks } = parsePassage(html)
    const [first, second] = blocks[0]?.segments ?? []
    expect(first?.inlines.map((inline) => inline.kind)).toEqual(['label', 'text', 'note', 'text'])
    expect(first?.inlines.at(-1)).toMatchObject({ kind: 'text', text: ' ' })
    expect(second?.inlines.map((inline) => inline.kind)).toEqual(['label', 'text'])
  })

  it('reads an English passage that opens with a Hebrew acrostic line as LTR', () => {
    // ASV Psalm 119: the acrostic letter sits in a `qc` line, not a heading.
    const html =
      '<div><div class="qc">א ALEPH.</div>' +
      '<div class="q1"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>Blessed are they that are perfect in the way,</div>' +
      '<div class="q2">Who walk in the law of Jehovah.</div></div>'
    expect(parsePassage(html).rtl).toBe(false)
  })

  it('reads a Hebrew passage as RTL', () => {
    const html =
      '<div><div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ</div></div>'
    expect(parsePassage(html).rtl).toBe(true)
  })

  it('puts a qs pause inside q on its own end-aligned line and leaves the following period', () => {
    const html =
      '<div><div class="q"><span class="yv-v" v="3"></span><span class="yv-vlbl">3</span>' +
      'the Holy One from the mountain. <span class="qs">Selah</span>.</div></div>'
    const { blocks, verses } = parsePassage(html)
    expect(blocks).toHaveLength(3)
    const poetry = blocks[0]
    const pause = blocks[1]
    const period = blocks[2]
    if (poetry === undefined || pause === undefined || period === undefined) {
      throw new Error('expected the poetry, the pause, and the period')
    }
    expect(lineTexts(poetry)).toEqual(['the Holy One from the mountain. '])
    expect(resolveBlock(poetry.classes, 16).align).toBe('left')
    expect(lineTexts(pause)).toEqual(['Selah'])
    const pauseRun = pause.segments[0]?.inlines[0]
    expect(pauseRun).toMatchObject({ kind: 'text', text: 'Selah' })
    if (pauseRun?.kind === 'text') {
      expect(pauseRun.classes).toContain('qs')
    }
    expect(resolveBlock(pause.classes, 16).align).toBe('end')
    expect(lineTexts(period)).toEqual(['.'])
    expect(resolveBlock(period.classes, 16).align).toBe('left')
    expect(verses.get(3)?.text).toBe('the Holy One from the mountain. Selah.')
  })

  it('keeps a period that is inside the qs span on the pause line', () => {
    const html =
      '<div><div class="q"><span class="yv-v" v="9"></span><span class="qs">Selah.</span></div></div>'
    const { blocks } = parsePassage(html)
    const line = blocks[0]
    if (line === undefined) {
      throw new Error('expected the pause line')
    }
    expect(blocks).toHaveLength(1)
    expect(lineTexts(line)).toEqual(['Selah.'])
    expect(resolveBlock(line.classes, 16).align).toBe('end')
  })

  it('puts a qs pause inside q4 on its own end-aligned line', () => {
    const html =
      '<div><div class="q4"><span class="yv-v" v="3"></span> <span class="qs">Pausa</span></div></div>'
    const { blocks } = parsePassage(html)
    const line = blocks[0]
    if (line === undefined) {
      throw new Error('expected the pause line')
    }
    expect(blocks).toHaveLength(1)
    expect(lineTexts(line)).toEqual(['Pausa'])
    expect(line.classes).toContain('q4')
    expect(resolveBlock(line.classes, 16).align).toBe('end')
  })

  it('leaves a qs pause inside qr on that right-aligned line', () => {
    const html =
      '<div><div class="qr"><span class="qs">Pause in his presence</span>' +
      '<span class="yv-n f"><span class="ft">Or Selah</span></span></div></div>'
    const { blocks } = parsePassage(html)
    const line = blocks[0]
    if (line === undefined) {
      throw new Error('expected the reference line')
    }
    expect(blocks).toHaveLength(1)
    expect(line.classes).toEqual(['qr'])
    expect(lineTexts(line)).toEqual(['Pause in his presence'])
    expect(lineKinds(line)).toEqual(['text', 'note'])
    expect(resolveBlock(line.classes, 16).align).toBe('right')
  })

  it('keeps a footnote marker on the same line as the qs pause', () => {
    const html =
      '<div><div class="q4"><span class="yv-v" v="3"></span><span class="qs">Pausa</span>' +
      '<span class="yv-n f"><span class="ft">Musical pause</span></span></div></div>'
    const { blocks } = parsePassage(html)
    const line = blocks[0]
    if (line === undefined) {
      throw new Error('expected the pause line')
    }
    expect(blocks).toHaveLength(1)
    expect(lineTexts(line)).toEqual(['Pausa'])
    expect(lineKinds(line)).toEqual(['text', 'note'])
    expect(resolveBlock(line.classes, 16).align).toBe('end')
  })

  it('reads an Arabic passage with a Latin note as RTL', () => {
    const html =
      '<div><div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>(LXX) فِي الْبَدْءِ خَلَقَ اللهُ السَّمَاوَاتِ وَالأَرْضَ</div></div>'
    expect(parsePassage(html).rtl).toBe(true)
  })
})

describe('parseNoteHtml', () => {
  it('keeps the USFM classes on each run, as the passage does', () => {
    expect(
      parseNoteHtml(
        '<span class="fr">1:16 </span><span class="ft">The Greek word for </span><span class="fqa">brothers and sisters</span>',
      ),
    ).toEqual([
      [
        { text: '1:16 ', classes: ['fr'] },
        { text: 'The Greek word for ', classes: ['ft'] },
        { text: 'brothers and sisters', classes: ['fqa'] },
      ],
    ])
  })

  it('starts a new paragraph at an fp span', () => {
    expect(
      parseNoteHtml(
        '<span class="ft">First paragraph.</span><span class="fp"><span class="fk">Keyword</span> text.</span>',
      ),
    ).toEqual([
      [{ text: 'First paragraph.', classes: ['ft'] }],
      [
        { text: 'Keyword', classes: ['fp', 'fk'] },
        { text: ' text.', classes: ['fp'] },
      ],
    ])
  })

  it('maps sup, b, and i tags onto their USFM classes and decodes entities', () => {
    expect(parseNoteHtml('&ldquo;Or&rdquo; <b>bold</b> <i>it</i><sup>a</sup>')).toEqual([
      [
        { text: '\u201COr\u201D ', classes: [] },
        { text: 'bold', classes: ['bd'] },
        { text: ' ', classes: [] },
        { text: 'it', classes: ['it'] },
        { text: 'a', classes: ['sup'] },
      ],
    ])
  })

  it('returns no paragraphs for empty html', () => {
    expect(parseNoteHtml('')).toEqual([])
    expect(parseNoteHtml('   ')).toEqual([])
  })
})

describe('collectVerses', () => {
  it('keeps the character classes in the footnote-sheet verse html', () => {
    const html =
      '<div><div class="p"><span class="yv-v" v="5"></span><span class="yv-vlbl">5</span>' +
      'He said, <span class="wj">Truly</span><span class="yv-n f"><span class="ft">Or</span></span></div></div>'
    const verse = parsePassage(html).verses.get(5)
    expect(verse?.html).toBe(
      'He said, <span class="wj">Truly</span><sup class="yv:text-muted-foreground">a</sup>',
    )
    expect(parseNoteHtml(verse?.html ?? '')).toEqual([
      [
        { text: 'He said, ', classes: [] },
        { text: 'Truly', classes: ['wj'] },
        { text: 'a', classes: ['yv:text-muted-foreground', 'sup'] },
      ],
    ])
  })
})
