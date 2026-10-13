/**
 * Layer 1 — the platform fork behind `verseActions`.
 * The host reads this once at module load, so a layer-3 test cannot move it.
 */
import { resolveVerseActions } from '../resolve-verse-actions'

describe('resolveVerseActions', () => {
  it('passes none on iOS', () => {
    expect(resolveVerseActions('ios')).toBe('none')
  })

  it('passes none on Android', () => {
    expect(resolveVerseActions('android')).toBe('none')
  })

  it('passes popover on web', () => {
    expect(resolveVerseActions('web')).toBe('popover')
  })

  it('treats an unknown platform as native, not web', () => {
    // Fail toward the native sheet: an unrecognized platform is far more likely
    // to be a new native target than a second web runtime, and `'popover'` is
    // the branch that hands verse actions back to the WebView.
    expect(resolveVerseActions('windows')).toBe('none')
  })
})
