import { LABEL_SCALE, resolveBlock, resolveChars } from '../styles'

const F = 20

describe('resolveBlock', () => {
  it('centres an intro major title at the title size', () => {
    const block = resolveBlock(['imt'], F)
    expect(block).toMatchObject({ align: 'center', size: F * 1.17, weight: 500 })
  })

  it('indents poetry in em so a larger font steps further in', () => {
    expect(resolveBlock(['q1'], F).headIndent).toBe(2 * F)
    expect(resolveBlock(['q2'], F).headIndent).toBe(4 * F)
    expect(resolveBlock(['q1'], 18).headIndent).toBe(36)
  })

  it('steps lists one em at a time, with level 2 at 3em', () => {
    expect(resolveBlock(['li1'], F).headIndent).toBe(2 * F)
    expect(resolveBlock(['li2'], F).headIndent).toBe(3 * F)
    expect(resolveBlock(['ili1'], F).headIndent).toBe(resolveBlock(['li1'], F).headIndent)
    expect(resolveBlock(['ili2'], F).headIndent).toBe(resolveBlock(['li2'], F).headIndent)
  })

  it('gives an intro explanation a first-line indent and no block indent', () => {
    const block = resolveBlock(['iex'], F)
    expect(block.firstIndent).toBe(F)
    expect(block.headIndent).toBe(0)
  })

  it('keeps aligned blocks off the gutters, as Swift spacers do', () => {
    expect(resolveBlock(['ms1'], F).alignInset).toEqual({ start: 8, end: 8 })
    expect(resolveBlock(['qr'], F).alignInset).toEqual({ start: 8, end: 0 })
    expect(resolveBlock(['p'], F).alignInset).toEqual({ start: 0, end: 0 })
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

  it('draws a translator addition in bold italic', () => {
    expect(resolveChars(['add'])).toMatchObject({ italic: true, weight: 700 })
  })
})
