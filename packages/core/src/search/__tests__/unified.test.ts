import { buildUnifiedSearchCall, mapUnifiedSearchImages } from '../unified'

describe('buildUnifiedSearchCall', () => {
  it('returns empty options and keeps bibleId and en_US language ranges', () => {
    expect(
      buildUnifiedSearchCall({
        query: 'love',
        bibleId: 111,
        languageRanges: ['en_US'],
      }),
    ).toEqual({
      query: 'love',
      bibleId: 111,
      languageRanges: ['en_US'],
      options: {},
    })
  })

  it('sets fields and userIntent on options when both are provided', () => {
    expect(
      buildUnifiedSearchCall({
        query: 'love',
        bibleId: 111,
        languageRanges: ['en_US'],
        fields: ['images'],
        userIntent: 'topical',
      }),
    ).toEqual({
      query: 'love',
      bibleId: 111,
      languageRanges: ['en_US'],
      options: { fields: ['images'], userIntent: 'topical' },
    })
  })
})

describe('mapUnifiedSearchImages', () => {
  it('maps id and passage_id onto passageId', () => {
    expect(mapUnifiedSearchImages([{ id: 'img-1', passage_id: 'JHN.3.16' }])).toEqual([
      { id: 'img-1', passageId: 'JHN.3.16' },
    ])
  })

  it('keeps an empty string id and passage id', () => {
    expect(mapUnifiedSearchImages([{ id: '', passage_id: '' }])).toEqual([
      { id: '', passageId: '' },
    ])
  })

  it('keeps a passage id that is not USFM', () => {
    expect(mapUnifiedSearchImages([{ id: 'img-2', passage_id: 'not-a-usfm' }])).toEqual([
      { id: 'img-2', passageId: 'not-a-usfm' },
    ])
  })

  it('returns an empty list for undefined and null', () => {
    expect(mapUnifiedSearchImages(undefined)).toEqual([])
    expect(mapUnifiedSearchImages(null)).toEqual([])
  })

  it('drops a missing id, a missing passage_id, a numeric id, and a null element', () => {
    expect(mapUnifiedSearchImages([{ passage_id: 'JHN.3.16' }])).toEqual([])
    expect(mapUnifiedSearchImages([{ id: 'img-1' }])).toEqual([])
    expect(mapUnifiedSearchImages([{ id: 1, passage_id: 'JHN.3.16' }])).toEqual([])
    expect(mapUnifiedSearchImages([null])).toEqual([])
  })

  it('keeps a valid image when a sibling hit is dropped', () => {
    expect(
      mapUnifiedSearchImages([
        { passage_id: 'GEN.1.1' },
        null,
        { id: 'img-1', passage_id: 'JHN.3.16' },
        { id: 2, passage_id: 'JHN.3.16' },
      ]),
    ).toEqual([{ id: 'img-1', passageId: 'JHN.3.16' }])
  })
})
