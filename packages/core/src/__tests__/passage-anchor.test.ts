import { biblePassageAnchorFromPassageId } from '../passage-anchor'

describe('biblePassageAnchorFromPassageId', () => {
  it('parses BOOK.CHAPTER.VERSE into a reference', () => {
    expect(biblePassageAnchorFromPassageId('JHN.3.16', 111)).toEqual({
      versionId: 111,
      bookId: 'JHN',
      chapter: 3,
      verse: 16,
    })
  })

  it('parses a chapter-only id without a verse', () => {
    expect(biblePassageAnchorFromPassageId('PSA.23', 111)).toEqual({
      versionId: 111,
      bookId: 'PSA',
      chapter: 23,
    })
    expect(biblePassageAnchorFromPassageId('JHN.3', 111)).toEqual({
      versionId: 111,
      bookId: 'JHN',
      chapter: 3,
    })
  })

  it('parses a verse range using the start verse as the anchor', () => {
    expect(biblePassageAnchorFromPassageId('JHN.3.16-17', 111)).toEqual({
      versionId: 111,
      bookId: 'JHN',
      chapter: 3,
      verse: 16,
    })
    expect(biblePassageAnchorFromPassageId('JHN.3.16-18', 111)).toEqual({
      versionId: 111,
      bookId: 'JHN',
      chapter: 3,
      verse: 16,
    })
  })

  it('returns null for a structurally invalid passage id', () => {
    expect(biblePassageAnchorFromPassageId('JHN.3.16.1', 111)).toBeNull()
    expect(biblePassageAnchorFromPassageId('.3.16', 111)).toBeNull()
    expect(biblePassageAnchorFromPassageId('JHN.0.16', 111)).toBeNull()
    expect(biblePassageAnchorFromPassageId('JHN.3.0', 111)).toBeNull()
    expect(biblePassageAnchorFromPassageId('JHN.3.16-0', 111)).toBeNull()
    expect(biblePassageAnchorFromPassageId('JHN.3.16-17-18', 111)).toBeNull()
    expect(biblePassageAnchorFromPassageId('JHN', 111)).toBeNull()
    expect(biblePassageAnchorFromPassageId('', 111)).toBeNull()
    expect(biblePassageAnchorFromPassageId('not-a-usfm', 111)).toBeNull()
    expect(biblePassageAnchorFromPassageId('J@N.3.16', 111)).toBeNull()
    expect(biblePassageAnchorFromPassageId('NOTABOOK.3.16', 111)).toBeNull()
    expect(biblePassageAnchorFromPassageId(' .3.16', 111)).toBeNull()
    expect(biblePassageAnchorFromPassageId('jhn.3.16', 111)).toBeNull()
  })

  it('parses a well-formed book code that is not a known book', () => {
    expect(biblePassageAnchorFromPassageId('XYZ.1.1', 111)).toEqual({
      versionId: 111,
      bookId: 'XYZ',
      chapter: 1,
      verse: 1,
    })
  })

  it('parses a digit-prefixed book code', () => {
    expect(biblePassageAnchorFromPassageId('1CO.13.4', 111)).toEqual({
      versionId: 111,
      bookId: '1CO',
      chapter: 13,
      verse: 4,
    })
  })

  it('returns null when a chapter or verse is not a safe integer', () => {
    const tooManyDigits = '1'.repeat(20)
    expect(biblePassageAnchorFromPassageId(`JHN.${tooManyDigits}.16`, 111)).toBeNull()
    expect(biblePassageAnchorFromPassageId(`JHN.3.${tooManyDigits}`, 111)).toBeNull()
    expect(biblePassageAnchorFromPassageId('JHN.9007199254740992.16', 111)).toBeNull()
    expect(biblePassageAnchorFromPassageId(`JHN.${tooManyDigits}`, 111)).toBeNull()
  })
})
