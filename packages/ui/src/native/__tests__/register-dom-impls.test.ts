import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BibleReaderNative } from '../bible-reader-native'
import { getImpl, resetImpls } from '../component-impls'
import { ensureDomImpls } from '../register-dom-impls'

const DOM_CALL = "getImpl('BibleTextViewDom')"

function callersOf(dir: string, root: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__') {
      continue
    }
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      callersOf(path, root, found)
      continue
    }
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) {
      continue
    }
    if (readFileSync(path, 'utf8').includes(DOM_CALL)) {
      found.push(path.slice(root.length + 1))
    }
  }
  return found
}

describe('reader renderer', () => {
  beforeEach(() => {
    resetImpls()
    ensureDomImpls()
  })

  it('draws the chapter with native text', () => {
    expect(getImpl('BibleReaderNative')).toBe(BibleReaderNative)
  })

  it('lets only the card and verse of the day mount BibleTextViewDom', () => {
    const root = join(__dirname, '../..')
    expect(callersOf(root, root).sort()).toEqual([
      'native/bible-card.tsx',
      'native/verse-of-the-day.tsx',
    ])
  })
})
