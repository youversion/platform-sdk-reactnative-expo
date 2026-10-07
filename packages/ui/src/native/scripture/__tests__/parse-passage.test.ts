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
})
