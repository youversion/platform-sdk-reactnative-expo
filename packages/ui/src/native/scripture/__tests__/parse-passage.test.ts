import { parsePassage } from '../parse-passage'

describe('parsePassage', () => {
  it('drops the chapter label block', () => {
    const html =
      '<div><div class="cl">Psalm 119</div>' +
      '<div class="q1"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>Blessed are those</div></div>'
    const { blocks } = parsePassage(html)
    expect(blocks.map((block) => block.classes)).toEqual([['q1']])
  })
})
