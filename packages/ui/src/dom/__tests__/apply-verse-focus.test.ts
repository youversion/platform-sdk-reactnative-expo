/**
 * Layer 1. The WebView applies this inside a `'use dom'` file that native
 * tests do not mount.
 */
import type { BibleReaderVerseFocus } from '../../native/bible-reader-navigation'
import { applyMountedVerseFocus, type VerseFocusCaller } from '../apply-verse-focus'

const JOHN_3_16: BibleReaderVerseFocus = {
  seq: 1,
  versionId: 111,
  passageId: 'JHN.3.16',
  scrollsToVerse: true,
  shouldFocus: true,
}

describe('applyMountedVerseFocus', () => {
  it('focuses a verse that was queued before the first mount', () => {
    const focusReference = jest.fn<void, Parameters<VerseFocusCaller['focusReference']>>()

    const next = applyMountedVerseFocus({ focusReference }, JOHN_3_16, 0)

    expect(focusReference).toHaveBeenCalledWith({ versionId: 111, passageId: 'JHN.3.16' }, true)
    expect(next).toBe(1)
  })

  it('does not focus the seq this mount already had', () => {
    const focusReference = jest.fn<void, Parameters<VerseFocusCaller['focusReference']>>()

    const next = applyMountedVerseFocus({ focusReference }, { ...JOHN_3_16, seq: 4 }, 4)

    expect(focusReference).not.toHaveBeenCalled()
    expect(next).toBe(4)
  })

  it('does not replay a focus after Expo reloads with a stale then current seq', () => {
    const focusReference = jest.fn<void, Parameters<VerseFocusCaller['focusReference']>>()
    const idle = {
      ...JOHN_3_16,
      seq: 0,
      versionId: 0,
      passageId: '',
      scrollsToVerse: false,
      shouldFocus: false,
    }

    let handled = applyMountedVerseFocus({ focusReference }, idle, 0, 0)
    handled = applyMountedVerseFocus({ focusReference }, JOHN_3_16, handled, 1)

    expect(focusReference).not.toHaveBeenCalled()
    expect(handled).toBe(1)
  })

  it('focuses when seq moves past the one already handled', () => {
    const focusReference = jest.fn<void, Parameters<VerseFocusCaller['focusReference']>>()

    const next = applyMountedVerseFocus(
      { focusReference },
      { ...JOHN_3_16, seq: 5, scrollsToVerse: false },
      4,
    )

    expect(focusReference).toHaveBeenCalledWith({ versionId: 111, passageId: 'JHN.3.16' }, false)
    expect(next).toBe(5)
  })

  it('does not focus when the host only changed chapter', () => {
    const focusReference = jest.fn<void, Parameters<VerseFocusCaller['focusReference']>>()

    const next = applyMountedVerseFocus(
      { focusReference },
      { ...JOHN_3_16, seq: 5, shouldFocus: false },
      4,
    )

    expect(focusReference).not.toHaveBeenCalled()
    expect(next).toBe(4)
  })

  it('stays up when the Web SDK rejects the passage', () => {
    const focusReference = jest.fn<void, Parameters<VerseFocusCaller['focusReference']>>(() => {
      throw new Error('Reader navigation requires a valid passage ID and Bible version ID')
    })
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {})

    const next = applyMountedVerseFocus(
      { focusReference },
      { ...JOHN_3_16, seq: 2, passageId: 'jhn.3.16' },
      1,
    )

    expect(next).toBe(2)
    expect(errorLog).toHaveBeenCalled()
    errorLog.mockRestore()
  })
})
