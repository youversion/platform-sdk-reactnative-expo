import { resolveVerseActions } from '../verse-actions'

describe('resolveVerseActions', () => {
  it('switches the in-WebView popover off on iOS', () => {
    expect(resolveVerseActions('ios')).toBe('none')
  })

  it('switches the in-WebView popover off on Android', () => {
    expect(resolveVerseActions('android')).toBe('none')
  })

  it('keeps the popover on web, where NativeSheet renders nothing', () => {
    // The regression guard. YPE-3710 originally hardcoded `'none'` for every
    // platform, which left web with no verse action UI at all — the native
    // sheet cannot replace it there because `NativeSheet` returns null on web.
    expect(resolveVerseActions('web')).toBe('popover')
  })

  it('treats an unknown platform as native, not web', () => {
    // Fail toward containment: an unrecognized platform is far more likely to be
    // a new native target than a second web runtime, and leaving the popover on
    // is the branch that lets the WebView own verse actions.
    expect(resolveVerseActions('windows')).toBe('none')
  })
})
