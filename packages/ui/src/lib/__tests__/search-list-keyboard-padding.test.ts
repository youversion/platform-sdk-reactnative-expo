import { searchListKeyboardPadding } from '../search-list-keyboard-padding'

describe('searchListKeyboardPadding', () => {
  it('adds no padding when the keyboard is closed', () => {
    expect(searchListKeyboardPadding(1334, 34, null)).toBe(0)
  })

  it('pads the part of an overlay keyboard that covers the list', () => {
    expect(
      searchListKeyboardPadding(1334, 34, { screenY: 1000, height: 334 }),
    ).toBe(300)
  })

  it('adds no padding when a resized window already ends at the keyboard', () => {
    expect(
      searchListKeyboardPadding(1000, 34, { screenY: 1000, height: 334 }),
    ).toBe(0)
  })

  it('uses keyboard height when screenY is missing', () => {
    expect(searchListKeyboardPadding(1334, 34, { screenY: 0, height: 300 })).toBe(266)
  })
})
