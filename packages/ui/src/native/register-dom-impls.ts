import { BibleReaderNative } from './bible-reader-native'
import { registerDefault } from './component-impls'
import FootnoteContent from './footnote-content'

let registered = false

/** Production entry. Tests register stubs. */
export function ensureDomImpls(): void {
  if (registered) return
  registered = true
  registerDefault('BibleReaderNative', BibleReaderNative)
  registerDefault('FootnoteContent', FootnoteContent)
}
