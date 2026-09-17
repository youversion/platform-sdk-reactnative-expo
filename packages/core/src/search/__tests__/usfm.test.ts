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

  it('parses a chapter-only id without a verse', () => {
    expect(bibleReferenceFromUsfm('PSA.23', 111)).toEqual({
      versionId: 111,
      bookId: 'PSA',
      chapter: 23,
    })
    expect(bibleReferenceFromUsfm('JHN.3', 111)).toEqual({
      versionId: 111,
      bookId: 'JHN',
      chapter: 3,
    })
  })

  it('parses a verse range using the start verse as the anchor', () => {
    expect(bibleReferenceFromUsfm('JHN.3.16-17', 111)).toEqual({
      versionId: 111,
      bookId: 'JHN',
      chapter: 3,
      verse: 16,
    })
    expect(bibleReferenceFromUsfm('JHN.3.16-18', 111)).toEqual({
      versionId: 111,
      bookId: 'JHN',
      chapter: 3,
      verse: 16,
    })
  })

  it('returns null for structurally invalid USFM', () => {
    expect(bibleReferenceFromUsfm('JHN.3.16.1', 111)).toBeNull()
    expect(bibleReferenceFromUsfm('.3.16', 111)).toBeNull()
    expect(bibleReferenceFromUsfm('JHN.0.16', 111)).toBeNull()
    expect(bibleReferenceFromUsfm('JHN.3.0', 111)).toBeNull()
    expect(bibleReferenceFromUsfm('JHN.3.16-0', 111)).toBeNull()
    expect(bibleReferenceFromUsfm('JHN.3.16-17-18', 111)).toBeNull()
    expect(bibleReferenceFromUsfm('JHN', 111)).toBeNull()
    expect(bibleReferenceFromUsfm('', 111)).toBeNull()
    expect(bibleReferenceFromUsfm('not-a-usfm', 111)).toBeNull()
  })

  it('returns null when a chapter or verse is not a safe integer', () => {
    const tooManyDigits = '1'.repeat(20)
    expect(bibleReferenceFromUsfm(`JHN.${tooManyDigits}.16`, 111)).toBeNull()
    expect(bibleReferenceFromUsfm(`JHN.3.${tooManyDigits}`, 111)).toBeNull()
    expect(bibleReferenceFromUsfm('JHN.9007199254740992.16', 111)).toBeNull()
    expect(bibleReferenceFromUsfm(`JHN.${tooManyDigits}`, 111)).toBeNull()
  })
})
