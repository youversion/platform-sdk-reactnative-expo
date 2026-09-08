import type { BibleReference } from '@youversion/platform-react-native-expo-core'

import { BibleReaderNavigation, createBibleReaderNavigation } from '../bible-reader-navigation'

const JOHN_3_16: BibleReference = {
  versionId: 111,
  bookId: 'JHN',
  chapter: 3,
  verse: 16,
}

const ROMANS_8_1: BibleReference = {
  versionId: 59,
  bookId: 'ROM',
  chapter: 8,
  verse: 1,
}

describe('BibleReaderNavigation', () => {
  it('request stores a full-chapter pending request including the verse', () => {
    const navigation = createBibleReaderNavigation()

    navigation.request(JOHN_3_16)

    expect(navigation.pendingRequest).toEqual({
      reference: JOHN_3_16,
      showsFullChapter: true,
      scrollsToVerse: false,
      shouldFocus: false,
    })
  })

  it('focusReference stores shouldFocus and scrollsToVerse without scrolling itself', () => {
    const navigation = createBibleReaderNavigation()

    navigation.focusReference(JOHN_3_16)

    expect(navigation.pendingRequest).toEqual({
      reference: JOHN_3_16,
      showsFullChapter: false,
      scrollsToVerse: true,
      shouldFocus: true,
    })

    navigation.focusReference(ROMANS_8_1, false)

    expect(navigation.pendingRequest).toEqual({
      reference: ROMANS_8_1,
      showsFullChapter: false,
      scrollsToVerse: false,
      shouldFocus: true,
    })
  })

  it('a newer call replaces the older pending request', () => {
    const navigation = createBibleReaderNavigation()

    navigation.request(JOHN_3_16)
    navigation.focusReference(ROMANS_8_1, true)

    expect(navigation.pendingRequest?.reference).toEqual(ROMANS_8_1)
    expect(navigation.pendingRequest?.shouldFocus).toBe(true)
  })

  it('consumePending returns the request once and leaves pending empty', () => {
    const navigation = createBibleReaderNavigation()
    navigation.request(JOHN_3_16)

    expect(navigation.consumePending()).toEqual({
      reference: JOHN_3_16,
      showsFullChapter: true,
      scrollsToVerse: false,
      shouldFocus: false,
    })
    expect(navigation.pendingRequest).toBeNull()
    expect(navigation.consumePending()).toBeNull()
  })

  it('createBibleReaderNavigation and new BibleReaderNavigation share the same API', () => {
    const created = createBibleReaderNavigation()
    const constructed = new BibleReaderNavigation()

    expect(created).toBeInstanceOf(BibleReaderNavigation)
    expect(constructed).toBeInstanceOf(BibleReaderNavigation)
    expect(created.request).toEqual(expect.any(Function))
    expect(created.focusReference).toEqual(expect.any(Function))
  })
})
