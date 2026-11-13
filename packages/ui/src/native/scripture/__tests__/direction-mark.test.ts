import { directionMark, stripDirectionMarks } from '../direction-mark'

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

describe('stripDirectionMarks', () => {
  it('removes U+200E and U+200F from a string', () => {
    expect(stripDirectionMarks('1 ‎API')).toBe('1 API')
    expect(stripDirectionMarks('يوحنا ‏١')).toBe('يوحنا ١')
  })
})
