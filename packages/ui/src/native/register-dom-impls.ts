import BibleReaderDom from '../dom/bible-reader'
import BibleReaderSettings from '../dom/bible-reader-settings'
import BibleTextViewDom from '../dom/bible-text-view'
import BibleVersionPickerContent from '../dom/bible-version-picker-content'
import FootnoteContent from '../dom/footnote-content'
import { registerDefault } from './component-impls'

let registered = false

/** Load real `'use dom'` components. Production entry only — tests register stubs. */
export function ensureDomImpls(): void {
  if (registered) return
  registered = true
  registerDefault('BibleReaderDom', BibleReaderDom)
  registerDefault('BibleReaderSettings', BibleReaderSettings)
  registerDefault('BibleTextViewDom', BibleTextViewDom)
  registerDefault('BibleVersionPickerContent', BibleVersionPickerContent)
  registerDefault('FootnoteContent', FootnoteContent)
}
