/**
 * Layer 1. The WebView applies this inside a `'use dom'` file that native
 * tests do not mount.
 */
import type { BibleReaderVerseFocus } from '../../native/bible-reader-navigation'
import {
  applyMountedVerseFocus,
  handledSeqForStream,
  type VerseFocusCaller,
} from '../apply-verse-focus'

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

  it('focuses a request that arrived before the WebView was ready', () => {
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
    handled = applyMountedVerseFocus({ focusReference }, JOHN_3_16, handled, 0)

    expect(focusReference).toHaveBeenCalledWith({ versionId: 111, passageId: 'JHN.3.16' }, true)
    expect(handled).toBe(1)
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

  it('focuses sequence 1 on a new stream after another stream already handled sequence 1', () => {
    const focusReference = jest.fn<void, Parameters<VerseFocusCaller['focusReference']>>()
    const caller = { focusReference }
    let handled = { stream: 1, seq: 0 }

    const first = applyMountedVerseFocus(
      caller,
      JOHN_3_16,
      handledSeqForStream(handled, 1),
      0,
    )
    handled = { stream: 1, seq: first }
    expect(focusReference).toHaveBeenCalledTimes(1)

    const acknowledged = applyMountedVerseFocus(
      caller,
      JOHN_3_16,
      handledSeqForStream(handled, 1),
      1,
    )
    handled = { stream: 1, seq: acknowledged }
    expect(focusReference).toHaveBeenCalledTimes(1)

    const beforeNext = handledSeqForStream(handled, 2)
    expect(beforeNext).toBe(0)
    const second = applyMountedVerseFocus(
      caller,
      { ...JOHN_3_16, passageId: 'ROM.8.1' },
      beforeNext,
      0,
    )
    handled = { stream: 2, seq: second }
    expect(focusReference).toHaveBeenCalledTimes(2)
    expect(focusReference).toHaveBeenLastCalledWith(
      { versionId: 111, passageId: 'ROM.8.1' },
      true,
    )

    applyMountedVerseFocus(
      caller,
      { ...JOHN_3_16, passageId: 'ROM.8.1' },
      handledSeqForStream(handled, 2),
      1,
    )
    expect(focusReference).toHaveBeenCalledTimes(2)

    applyMountedVerseFocus(caller, JOHN_3_16, handledSeqForStream(handled, 1), 1)
    expect(focusReference).toHaveBeenCalledTimes(2)
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
