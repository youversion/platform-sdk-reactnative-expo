import BibleReaderDom from '../../dom/bible-reader'
import { getImpl } from '../component-impls'
import { BibleReaderNative } from '../bible-reader-native'
import { ensureDomImpls, unstable_setReaderRenderer } from '../register-dom-impls'

describe('reader renderer', () => {
  beforeEach(() => {
    ensureDomImpls()
    unstable_setReaderRenderer('native')
  })

  it('draws the chapter with native text', () => {
    expect(getImpl('BibleReaderDom')).toBe(BibleReaderNative)
  })

  it('mounts the WebView reader when a host asks for it', () => {
    unstable_setReaderRenderer('dom')
    expect(getImpl('BibleReaderDom')).toBe(BibleReaderDom)
  })
})
