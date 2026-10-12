import { parseNoteHtml, parsePassage } from '../parse-passage'

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
