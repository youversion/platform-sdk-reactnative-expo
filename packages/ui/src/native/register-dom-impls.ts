import BibleReaderDom from '../dom/bible-reader'
import BibleTextViewDom from '../dom/bible-text-view'
import FootnoteContent from '../dom/footnote-content'
import { registerDefault } from './component-impls'

let registered = false

/** Load real `'use dom'` components. Production entry only — tests register stubs. */
export function ensureDomImpls(): void {
  if (registered) return
  registered = true
  registerDefault('BibleReaderDom', BibleReaderDom)
  registerDefault('BibleTextViewDom', BibleTextViewDom)
  registerDefault('FootnoteContent', FootnoteContent)
}
