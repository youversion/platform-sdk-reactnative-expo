import BibleCardDom from '../dom/bible-card'
import BibleReaderDom from '../dom/bible-reader'
import BibleReaderSettings from '../dom/bible-reader-settings'
import BibleTextViewDom from '../dom/bible-text-view'
import BibleVersionPickerContent from '../dom/bible-version-picker-content'
import ChapterPickerContent from '../dom/chapter-picker-content'
import FootnoteContent from '../dom/footnote-content'
import VerseOfTheDayDom from '../dom/verse-of-the-day'
import { registerDefault } from './component-impls'

let registered = false

/** Load real `'use dom'` components. Production entry only — tests register stubs. */
export function ensureDomImpls(): void {
  if (registered) return
  registered = true
  registerDefault('BibleCardDom', BibleCardDom)
  registerDefault('BibleReaderDom', BibleReaderDom)
  registerDefault('BibleReaderSettings', BibleReaderSettings)
  registerDefault('BibleTextViewDom', BibleTextViewDom)
  registerDefault('BibleVersionPickerContent', BibleVersionPickerContent)
  registerDefault('ChapterPickerContent', ChapterPickerContent)
  registerDefault('FootnoteContent', FootnoteContent)
  registerDefault('VerseOfTheDayDom', VerseOfTheDayDom)
}
