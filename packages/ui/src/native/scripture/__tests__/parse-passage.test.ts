import { parsePassage } from '../parse-passage'

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
