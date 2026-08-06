/**
 * Layer 1 — the platform fork behind `verseActions`.
 *
 * Layer 3 cannot see this: a jest run is one platform, and the value is consumed
 * inside a `'use dom'` file that no native test renders. These four cases are the
 * whole coverage the branch gets.
 */
import { resolveVerseActions } from '../resolve-verse-actions'

describe('resolveVerseActions', () => {
  it('switches the in-WebView popover off on iOS', () => {
    expect(resolveVerseActions('ios')).toBe('none')
  })

  it('switches the in-WebView popover off on Android', () => {
    expect(resolveVerseActions('android')).toBe('none')
  })

  it('keeps the popover on web, where NativeSheet renders nothing', () => {
    // The regression guard. Hardcoding `'none'` for every platform leaves web
    // with no verse action UI at all — the native sheet cannot replace it there,
    // because `NativeSheet` returns null on web.
    expect(resolveVerseActions('web')).toBe('popover')
  })

  it('treats an unknown platform as native, not web', () => {
    // Fail toward the native sheet: an unrecognized platform is far more likely
    // to be a new native target than a second web runtime, and `'popover'` is
    // the branch that hands verse actions back to the WebView.
    expect(resolveVerseActions('windows')).toBe('none')
  })
})
