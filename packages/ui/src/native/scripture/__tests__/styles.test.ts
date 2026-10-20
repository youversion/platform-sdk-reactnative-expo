import { LABEL_SCALE, resolveBlock, resolveChars } from '../styles'

const F = 20

describe('resolveBlock', () => {
  it('draws an intro major title left-aligned in bold at the title size', () => {
    const block = resolveBlock(['imt'], F)
    expect(block).toMatchObject({ align: 'left', size: F * 1.17, weight: 700 })
  })

  it('gives a later section heading 1em of space above', () => {
    expect(resolveBlock(['s1'], F).top).toBe(1)
  })

  it('keeps a parallel reference left-aligned with a half-em bottom', () => {
    expect(resolveBlock(['r'], F)).toMatchObject({ align: 'left', bottom: 0.5 })
  })

  it('draws a major title large and medium, left-aligned', () => {
    expect(resolveBlock(['mt1'], F)).toMatchObject({
      size: F * 1.6,
      weight: 500,
      align: 'left',
    })
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

  it('centers a level-2 intro heading, bold, with half-em space above and below', () => {
    expect(resolveBlock(['is2'], F)).toMatchObject({
      weight: 700,
      align: 'center',
      top: 0.5,
      bottom: 0.5,
      size: F,
    })
    expect(resolveBlock(['iot'], F)).toMatchObject({
      weight: 700,
      align: 'center',
      top: 0.5,
      bottom: 0.5,
      size: F,
    })
  })

  it('centers an intro ending title, bold, with a full em above', () => {
    expect(resolveBlock(['imte'], F)).toMatchObject({ weight: 700, top: 1, bottom: 0.25, align: 'center' })
    expect(resolveBlock(['imte1'], F)).toMatchObject(resolveBlock(['imte'], F))
  })

  it('centers an italic intro ending subtitle', () => {
    expect(resolveBlock(['imte2'], F)).toMatchObject({
      italic: true,
      align: 'center',
      top: 0.5,
      bottom: 0.15,
    })
  })

  it('indents an intro outline one em deeper at each level', () => {
    expect(resolveBlock(['io'], F).headIndent).toBe(2 * F)
    expect(resolveBlock(['io1'], F).headIndent).toBe(2 * F)
    expect(resolveBlock(['io2'], F).headIndent).toBe(3 * F)
    expect(resolveBlock(['io3'], F).headIndent).toBe(4 * F)
  })

  it('indents an intro paragraph two em and quotes it in italic', () => {
    expect(resolveBlock(['imi'], F)).toMatchObject({ firstIndent: 0, headIndent: 2 * F, bottom: 0.6 })
    expect(resolveBlock(['ipq'], F)).toMatchObject({ italic: true, firstIndent: F, headIndent: 2 * F })
    expect(resolveBlock(['ipr'], F)).toMatchObject({ italic: true, align: 'right' })
  })

  it('shares a main title with its level-1 alias, and an embedded list with its alias', () => {
    expect(resolveBlock(['mt'], F)).toMatchObject(resolveBlock(['mt1'], F))
    expect(resolveBlock(['lim1'], F).headIndent).toBe(resolveBlock(['lim'], F).headIndent)
  })

  it('draws a chapter description in italic, and medium italic inside a heading', () => {
    expect(resolveBlock(['cd'], F)).toMatchObject({ italic: true, weight: 400 })
    expect(resolveBlock(['cd', 'yv-h'], F)).toMatchObject({ italic: true, weight: 500 })
  })

  it('italicizes a poetic closing note and right-aligns a paragraph', () => {
    expect(resolveBlock(['qd'], F).italic).toBe(true)
    expect(resolveBlock(['pr'], F).align).toBe('right')
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

  it('draws a translator addition in italic at the body weight', () => {
    expect(resolveChars(['add'])).toMatchObject({ italic: true, weight: null })
  })

  it('italicizes a secondary language and an intro quotation', () => {
    expect(resolveChars(['sls']).italic).toBe(true)
    expect(resolveChars(['iqt']).italic).toBe(true)
  })

  it('draws a keyword in bold', () => {
    expect(resolveChars(['k'])).toMatchObject({ weight: 700, italic: false })
  })

  it('draws a bold-italic run in medium italic', () => {
    expect(resolveChars(['bdit'])).toMatchObject({ weight: 500, italic: true })
  })
})
