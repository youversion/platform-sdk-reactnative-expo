import { directionMark } from '../direction-mark'

describe('directionMark', () => {
  it('leads Android text with the mark for its direction', () => {
    expect(directionMark(true, 'android')).toBe('‏')
    expect(directionMark(false, 'android')).toBe('‎')
  })

  it('adds nothing on iOS, which honours writingDirection', () => {
    expect(directionMark(true, 'ios')).toBe('')
    expect(directionMark(false, 'ios')).toBe('')
  })
})
