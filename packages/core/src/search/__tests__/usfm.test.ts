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
  })

  it('returns null when a chapter or verse is not a safe integer', () => {
    const tooManyDigits = '1'.repeat(20)
    expect(bibleReferenceFromUsfm(`JHN.${tooManyDigits}.16`, 111)).toBeNull()
    expect(bibleReferenceFromUsfm(`JHN.3.${tooManyDigits}`, 111)).toBeNull()
    expect(bibleReferenceFromUsfm('JHN.9007199254740992.16', 111)).toBeNull()
  })
})
