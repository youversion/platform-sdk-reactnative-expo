import { LABEL_SCALE, resolveBlock, resolveChars } from '../styles'

const F = 20

describe('resolveBlock', () => {
  it('centres an intro major title at the title size', () => {
    const block = resolveBlock(['imt'], F)
    expect(block).toMatchObject({ align: 'center', size: F * 1.17, weight: 500 })
  })

  it('indents intro list items like their scripture counterparts', () => {
    expect(resolveBlock(['ili1'], F).headIndent).toBe(resolveBlock(['li1'], F).headIndent)
    expect(resolveBlock(['ili'], F).headIndent).toBe(16)
    expect(resolveBlock(['ili2'], F).headIndent).toBe(32)
  })

  it('gives an intro explanation a first-line indent and no block indent', () => {
    const block = resolveBlock(['iex'], F)
    expect(block.firstIndent).toBe(F * 0.75)
    expect(block.headIndent).toBe(0)
  })
})

describe('resolveChars', () => {
  it('shrinks and raises ordinals and superscripts', () => {
    for (const name of ['ord', 'fv', 'sup']) {
      expect(resolveChars([name])).toMatchObject({ scale: LABEL_SCALE, raised: true })
    }
  })

  it('leaves ordinary runs on the baseline', () => {
    expect(resolveChars(['nd']).raised).toBe(false)
  })
})
