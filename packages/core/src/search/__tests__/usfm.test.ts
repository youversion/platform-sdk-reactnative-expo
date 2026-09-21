import { bibleReferenceFromUsfm } from '../usfm'

describe('bibleReferenceFromUsfm', () => {
  it('parses BOOK.CHAPTER.VERSE into a reference', () => {
    expect(bibleReferenceFromUsfm('JHN.3.16', 111)).toEqual({
      versionId: 111,
      bookId: 'JHN',
      chapter: 3,
      verse: 16,
    })
  })

  it('returns null for invalid USFM', () => {
    expect(bibleReferenceFromUsfm('JHN.3', 111)).toBeNull()
    expect(bibleReferenceFromUsfm('JHN.3.16.1', 111)).toBeNull()
    expect(bibleReferenceFromUsfm('.3.16', 111)).toBeNull()
    expect(bibleReferenceFromUsfm('JHN.0.16', 111)).toBeNull()
    expect(bibleReferenceFromUsfm('JHN.3.0', 111)).toBeNull()
    expect(bibleReferenceFromUsfm('JHN.3.16-18', 111)).toBeNull()
    expect(bibleReferenceFromUsfm('', 111)).toBeNull()
    expect(bibleReferenceFromUsfm('J@N.3.16', 111)).toBeNull()
    expect(bibleReferenceFromUsfm('NOTABOOK.3.16', 111)).toBeNull()
    expect(bibleReferenceFromUsfm(' .3.16', 111)).toBeNull()
    expect(bibleReferenceFromUsfm('jhn.3.16', 111)).toBeNull()
  })

  it('parses a well-formed book code that is not a known book', () => {
    expect(bibleReferenceFromUsfm('XYZ.1.1', 111)).toEqual({
      versionId: 111,
      bookId: 'XYZ',
      chapter: 1,
      verse: 1,
    })
  })

  it('parses a digit-prefixed USFM book code', () => {
    expect(bibleReferenceFromUsfm('1CO.13.4', 111)).toEqual({
      versionId: 111,
      bookId: '1CO',
      chapter: 13,
      verse: 4,
    })
  })

  it('returns null when a chapter or verse is not a safe integer', () => {
    const tooManyDigits = '1'.repeat(20)
    expect(bibleReferenceFromUsfm(`JHN.${tooManyDigits}.16`, 111)).toBeNull()
    expect(bibleReferenceFromUsfm(`JHN.3.${tooManyDigits}`, 111)).toBeNull()
    expect(bibleReferenceFromUsfm('JHN.9007199254740992.16', 111)).toBeNull()
  })
})
