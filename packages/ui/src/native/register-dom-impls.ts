import BibleReaderDom from '../dom/bible-reader'
import BibleReaderSettings from '../dom/bible-reader-settings'
import BibleTextViewDom from '../dom/bible-text-view'
import BibleVersionPickerContent from '../dom/bible-version-picker-content'
import ChapterPickerContent from '../dom/chapter-picker-content'
import FootnoteContent from './footnote-content'
import { registerDefault } from './component-impls'

let registered = false

/** Production entry. Tests register stubs. */
export function ensureDomImpls(): void {
  if (registered) return
  registered = true
  registerDefault('BibleReaderDom', BibleReaderDom)
  registerDefault('BibleReaderSettings', BibleReaderSettings)
  registerDefault('BibleTextViewDom', BibleTextViewDom)
  registerDefault('BibleVersionPickerContent', BibleVersionPickerContent)
  registerDefault('ChapterPickerContent', ChapterPickerContent)
  registerDefault('FootnoteContent', FootnoteContent)
}
