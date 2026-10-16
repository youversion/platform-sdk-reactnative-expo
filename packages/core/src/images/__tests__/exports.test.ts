import * as core from '../../index'

describe('images package exports', () => {
  it('exposes the images hook', () => {
    expect(core.useImages).toEqual(expect.any(Function))
  })

  it('keeps the client wrapper and the Result seam internal', () => {
    const names = Object.keys(core)
    expect(names).not.toContain('createImagesApi')
    expect(names).not.toContain('ok')
    expect(names).not.toContain('err')
  })
})
