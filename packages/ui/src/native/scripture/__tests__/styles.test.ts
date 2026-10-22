import { LABEL_SCALE, resolveBlock, resolveChars } from '../styles'

const F = 20

describe('resolveBlock', () => {
  it('centers an intro major title at the medium title size', () => {
    const block = resolveBlock(['imt'], F)
    expect(block).toMatchObject({ align: 'center', size: F * 1.17, weight: 500 })
  })

  it('sets a section heading flush with the block above', () => {
    expect(resolveBlock(['s1'], F).top).toBe(0)
  })

  it('centers a parallel reference with a quarter-em bottom', () => {
    expect(resolveBlock(['r'], F)).toMatchObject({ align: 'center', bottom: 0.25 })
  })

  it('centers a main title at the medium title size', () => {
    expect(resolveBlock(['mt1'], F)).toMatchObject({
      size: F * 1.17,
      weight: 500,
      align: 'center',
    })
    expect(resolveBlock(['mt2'], F)).toMatchObject({
      size: F * 1.17,
      italic: true,
      align: 'center',
    })
  })

  it('centers every intro heading level', () => {
    for (const name of ['imt1', 'imt2', 'imt3', 'imt4', 'is', 'is1']) {
      expect(resolveBlock([name], F).align).toBe('center')
    }
  })

  it('indents blocks in 8pt steps whatever the font size', () => {
    expect(resolveBlock(['q1'], F).headIndent).toBe(16)
    expect(resolveBlock(['q2'], F).headIndent).toBe(32)
    expect(resolveBlock(['q1'], 30).headIndent).toBe(16)
  })

  it('steps lists and their intro aliases like poetry', () => {
    for (const [name, head] of [
      ['li1', 16],
      ['li2', 32],
      ['li3', 48],
      ['li4', 64],
      ['ili3', 48],
      ['ili4', 64],
      ['lim', 16],
    ] as const) {
      expect(resolveBlock([name], F).headIndent).toBe(head)
    }
  })

  it('indents intro poetry like poetry', () => {
    for (const level of ['', '1', '2', '3', '4']) {
      expect(resolveBlock([`iq${level}`], F).headIndent).toBe(
        resolveBlock([`q${level}`], F).headIndent,
      )
    }
  })

  it('indents the first line 0.75em per unit', () => {
    expect(resolveBlock(['p'], F).firstIndent).toBe(0.75 * F)
    expect(resolveBlock(['pi2'], F)).toMatchObject({ firstIndent: 0.75 * F, headIndent: 32 })
  })

  it('gives an intro explanation a first-line indent and no block indent', () => {
    const block = resolveBlock(['iex'], F)
    expect(block.firstIndent).toBe(0.75 * F)
    expect(block.headIndent).toBe(0)
  })

  it('sets an embedded poetic line flush', () => {
    expect(resolveBlock(['qm'], F).headIndent).toBe(0)
    expect(resolveBlock(['pi'], F)).toMatchObject({ firstIndent: 0, headIndent: 0 })
  })

  it('quotes an intro passage in italic with a full em around it', () => {
    expect(resolveBlock(['imq'], F)).toMatchObject({
      italic: true,
      top: 1,
      bottom: 1,
      headIndent: 16,
    })
  })

  it('drops the first-line indent inside a heading', () => {
    expect(resolveBlock(['p', 'yv-h'], F).firstIndent).toBe(0)
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
    expect(resolveBlock(['imte'], F)).toMatchObject({
      weight: 700,
      top: 1,
      bottom: 0.25,
      align: 'center',
    })
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

  it('indents an intro outline one step deeper at each level', () => {
    expect(resolveBlock(['io'], F).headIndent).toBe(16)
    expect(resolveBlock(['io1'], F).headIndent).toBe(16)
    expect(resolveBlock(['io2'], F).headIndent).toBe(24)
    expect(resolveBlock(['io3'], F).headIndent).toBe(32)
    expect(resolveBlock(['io4'], F).headIndent).toBe(32)
  })

  it('indents an intro paragraph and quotes it in italic', () => {
    expect(resolveBlock(['imi'], F)).toMatchObject({ firstIndent: 0, headIndent: 16, bottom: 0.6 })
    expect(resolveBlock(['ipq'], F)).toMatchObject({
      italic: true,
      firstIndent: 0.75 * F,
      headIndent: 16,
    })
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
    expect(resolveBlock(['cls'], F).align).toBe('right')
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
    expect(resolveChars(['k'])).toMatchObject({ weight: 700, italic: null })
  })

  it('sets a proper name upright at the body weight', () => {
    expect(resolveChars(['pn'])).toMatchObject({ weight: 400, italic: false })
  })

  it('draws a bold-italic run in medium italic', () => {
    expect(resolveChars(['bdit'])).toMatchObject({ weight: 500, italic: true })
  })
})
