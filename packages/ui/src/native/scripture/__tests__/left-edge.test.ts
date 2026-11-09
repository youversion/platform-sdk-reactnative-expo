import { leftEdge } from '../left-edge'

describe('leftEdge', () => {
  it('keeps left in an LTR app', () => {
    expect(leftEdge(12, true, false)).toEqual({ left: 12 })
    expect(leftEdge(12, false, false)).toEqual({ left: 12 })
  })

  it('uses right for an RTL passage in an RTL app, where right is the physical left', () => {
    expect(leftEdge(12, true, true)).toEqual({ right: 12 })
  })

  it('keeps left for an LTR passage in an RTL app', () => {
    expect(leftEdge(12, false, true)).toEqual({ left: 12 })
  })
})
