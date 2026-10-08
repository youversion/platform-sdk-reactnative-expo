import { buildVerseSelection, formatVerseNumbers, parseFocusPassageId } from '../selection'

const texts = new Map([
  [16, 'For God so loved the world'],
  [17, 'For God did not send his Son'],
  [19, 'This is the verdict'],
])

const base = {
  versionId: 3034,
  book: 'JHN',
  chapter: '3',
  bookTitle: 'John',
  versionAbbreviation: 'BSB',
  verseTexts: texts,
}

describe('buildVerseSelection', () => {
  it('builds the sorted payload with ids, reference, and share text', () => {
    const selection = buildVerseSelection({ ...base, verses: [17, 16] })
    expect(selection).toEqual({
      versionId: 3034,
      book: 'JHN',
      chapter: '3',
      verses: [16, 17],
      passageIds: ['JHN.3.16', 'JHN.3.17'],
      reference: 'John 3:16-17',
      shareData: {
        text: '“For God so loved the world For God did not send his Son”\n\nJohn 3:16-17 BSB',
        reference: 'John 3:16-17 BSB',
        verseText: 'For God so loved the world For God did not send his Son',
        verses: [16, 17],
        book: 'JHN',
        chapter: '3',
        versionId: 3034,
      },
    })
  })

  it('marks a gap with an ellipsis and comma-joins the ranges', () => {
    const selection = buildVerseSelection({ ...base, verses: [16, 17, 19] })
    expect(selection.reference).toBe('John 3:16-17,19')
    expect(selection.shareData?.verseText).toBe(
      'For God so loved the world For God did not send his Son ... This is the verdict',
    )
  })

  it('falls back to the USFM book and drops a missing abbreviation', () => {
    const selection = buildVerseSelection({
      ...base,
      bookTitle: null,
      versionAbbreviation: null,
      verses: [16],
    })
    expect(selection.reference).toBe('JHN 3:16')
    expect(selection.shareData?.reference).toBe('JHN 3:16')
  })

  it('carries an empty reference and null share data when nothing is selected', () => {
    const selection = buildVerseSelection({ ...base, verses: [] })
    expect(selection).toEqual({
      versionId: 3034,
      book: 'JHN',
      chapter: '3',
      verses: [],
      passageIds: [],
      reference: '',
      shareData: null,
    })
  })
})

describe('formatVerseNumbers', () => {
  it('dedupes and collapses runs', () => {
    expect(formatVerseNumbers([5, 1, 2, 3, 3, 7, 8])).toBe('1-3,5,7-8')
  })
})

describe('parseFocusPassageId', () => {
  it('reads a single verse and a range', () => {
    expect(parseFocusPassageId('PSA.119.105')).toEqual({
      book: 'PSA',
      chapter: '119',
      verses: [105],
    })
    expect(parseFocusPassageId('JHN.3.16-18')).toEqual({
      book: 'JHN',
      chapter: '3',
      verses: [16, 17, 18],
    })
  })

  it('returns null for a chapter-only id', () => {
    expect(parseFocusPassageId('JHN.3')).toBeNull()
  })

  it('caps a malformed range', () => {
    expect(parseFocusPassageId('PSA.119.1-999999999')?.verses).toHaveLength(250)
  })
})
