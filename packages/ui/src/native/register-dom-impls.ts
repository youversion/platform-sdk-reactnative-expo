import BibleReaderDom from '../dom/bible-reader'
import BibleTextViewDom from '../dom/bible-text-view'
import { registerDefault, removeImpl, setImpl } from './component-impls'
import FootnoteContent from './footnote-content'
import { BibleReaderNative } from './bible-reader-native'

let registered = false

/** Production entry. Tests register stubs. */
export function ensureDomImpls(): void {
  if (registered) return
  registered = true
  registerDefault('BibleReaderDom', BibleReaderNative)
  registerDefault('BibleTextViewDom', BibleTextViewDom)
  registerDefault('FootnoteContent', FootnoteContent)
}

/**
 * Mount the WebView reader for comparison, or return to the native chapter.
 * Remount `BibleReader` after a change so it picks up the new impl.
 */
export function unstable_setReaderRenderer(renderer: 'dom' | 'native'): void {
  if (renderer === 'dom') {
    setImpl('BibleReaderDom', BibleReaderDom)
    return
  }
  removeImpl('BibleReaderDom')
}
