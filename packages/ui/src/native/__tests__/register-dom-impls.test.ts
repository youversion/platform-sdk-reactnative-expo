import { BibleReaderNative } from '../bible-reader-native'
import { getImpl, resetImpls } from '../component-impls'
import { ensureDomImpls } from '../register-dom-impls'

describe('reader renderer', () => {
  beforeEach(() => {
    resetImpls()
    ensureDomImpls()
  })

  it('draws the chapter with native text', () => {
    expect(getImpl('BibleReaderDom')).toBe(BibleReaderNative)
  })
})
