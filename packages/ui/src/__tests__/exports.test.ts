/**
 * Guards the public API surface of the UI package, the way
 * `packages/core/src/highlights/__tests__/exports.test.ts` guards core's. The
 * nine components plus `useSignOutGuard` are the supported surface; the sheets
 * the SDK wires for itself stay off the package namespace, so a consumer cannot
 * couple to them and an accidental re-export from `index.ts` reds the suite.
 *
 * Only the namespace is inspected. Nothing renders, so the DOM components the
 * native wrappers import stay unmocked — importing them is safe, mounting them
 * is what the layer-3 convention forbids.
 */
import * as ui from '../index'

const PUBLIC_COMPONENTS = [
  'BibleCard',
  'BibleChapterPickerSheet',
  'BibleReader',
  'BibleReaderSettingsSheet',
  'BibleTextView',
  'BibleVersionPickerSheet',
  'VerseOfTheDay',
  'YouVersionAuthButton',
  'YouVersionProvider',
] as const

describe('package exports', () => {
  // Named one by one rather than looped over `PUBLIC_COMPONENTS`: a computed
  // read off the namespace is something neither ESLint nor tsc can check, so
  // the loop would pass on a name no longer exported.
  it('exposes the public components and the sign-out guard', () => {
    expect(typeof ui.BibleCard).toBe('function')
    expect(typeof ui.BibleChapterPickerSheet).toBe('function')
    expect(typeof ui.BibleReader).toBe('function')
    expect(typeof ui.BibleReaderSettingsSheet).toBe('function')
    expect(typeof ui.BibleTextView).toBe('function')
    expect(typeof ui.BibleVersionPickerSheet).toBe('function')
    expect(typeof ui.VerseOfTheDay).toBe('function')
    expect(typeof ui.YouVersionAuthButton).toBe('function')
    expect(typeof ui.YouVersionProvider).toBe('function')
    expect(typeof ui.useSignOutGuard).toBe('function')
  })

  it('keeps the SDK-owned sheets internal', () => {
    const names = Object.keys(ui)
    expect(names).not.toContain('BibleVerseActionSheet')
    expect(names).not.toContain('HighlightConsentSheet')
    expect(names).not.toContain('SignInWithYouVersionSheet')
    expect(names).not.toContain('NativeSheet')
    expect(names).not.toContain('NativeSheetProvider')
    expect(names).not.toContain('PromptSheetButton')
    expect(names).not.toContain('PromptSheetParagraph')
    expect(names).not.toContain('useVerseOfTheDayPassageId')
    expect(names).not.toContain('getVerseOfTheDayPassageId')
    expect(names).not.toContain('getDayOfYear')
  })

  it('exports nothing beyond the pinned list', () => {
    expect(Object.keys(ui).sort()).toEqual([...PUBLIC_COMPONENTS, 'useSignOutGuard'].sort())
  })
})
