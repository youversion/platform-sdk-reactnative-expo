import {
  IOS_TAB_BAR_CLEARANCE,
  READER_SCROLL_END_GAP,
  computeReaderBottomScrollPadding,
} from '../reader-bottom-scroll-padding'

describe('computeReaderBottomScrollPadding', () => {
  it('adds tab bar clearance, home indicator, and gap on iOS', () => {
    expect(computeReaderBottomScrollPadding(34, 'ios')).toBe(
      IOS_TAB_BAR_CLEARANCE + 34 + READER_SCROLL_END_GAP,
    )
  })

  it('applies tab bar clearance on iOS even when home indicator inset is zero', () => {
    expect(computeReaderBottomScrollPadding(0, 'ios')).toBe(
      IOS_TAB_BAR_CLEARANCE + READER_SCROLL_END_GAP,
    )
  })

  it('returns zero on Android when there is no bottom safe area', () => {
    expect(computeReaderBottomScrollPadding(0, 'android')).toBe(0)
  })

  it('adds only a small gap on Android when bottom safe area is present', () => {
    expect(computeReaderBottomScrollPadding(24, 'android')).toBe(READER_SCROLL_END_GAP)
  })
})
