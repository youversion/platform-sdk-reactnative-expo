import type { BibleReference } from '@youversion/platform-react-native-expo-core'
import { act, renderHook } from '@testing-library/react-native'

import {
  BibleReaderNavigation,
  createBibleReaderNavigation,
  useConsumedNavigationRequest,
} from '../bible-reader-navigation'

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

    const { result } = renderHook(() => useConsumedNavigationRequest(navigation))

    expect(result.current).toEqual({
      reference: JOHN_3_16,
      showsFullChapter: true,
      scrollsToVerse: false,
      shouldFocus: false,
    })
  })

  it('focusReference stores shouldFocus and scrollsToVerse without scrolling itself', () => {
    const navigation = createBibleReaderNavigation()

    navigation.focusReference(JOHN_3_16)

    const { result } = renderHook(() => useConsumedNavigationRequest(navigation))

    expect(result.current).toEqual({
      reference: JOHN_3_16,
      showsFullChapter: false,
      scrollsToVerse: true,
      shouldFocus: true,
    })

    act(() => {
      navigation.focusReference(ROMANS_8_1, false)
    })

    expect(result.current).toEqual({
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

    const { result } = renderHook(() => useConsumedNavigationRequest(navigation))

    expect(result.current?.reference).toEqual(ROMANS_8_1)
    expect(result.current?.shouldFocus).toBe(true)
  })

  it('keeps verse fields on an uncommitted pending request', () => {
    const navigation = createBibleReaderNavigation()
    navigation.request(JOHN_3_16)

    const { result } = renderHook(() => useConsumedNavigationRequest(navigation))

    expect(result.current?.reference.verse).toBe(16)
    expect(result.current?.scrollsToVerse).toBe(false)
    expect(result.current?.shouldFocus).toBe(false)
  })

  it('createBibleReaderNavigation and new BibleReaderNavigation share the host API', () => {
    const created = createBibleReaderNavigation()
    const constructed = new BibleReaderNavigation()

    expect(created).toBeInstanceOf(BibleReaderNavigation)
    expect(constructed).toBeInstanceOf(BibleReaderNavigation)
    expect(created.request).toEqual(expect.any(Function))
    expect(created.focusReference).toEqual(expect.any(Function))
    expect(created).not.toHaveProperty('pendingRequest')
    expect(created).not.toHaveProperty('subscribe')
    expect(created).not.toHaveProperty('getSnapshot')
    expect(created).not.toHaveProperty('consumePending')
    expect(created).not.toHaveProperty('consumeCommitted')
  })
})

describe('useConsumedNavigationRequest', () => {
  it('applies a pre-mount request once and keeps verse fields on that request', () => {
    const navigation = createBibleReaderNavigation()
    navigation.request(JOHN_3_16)

    const { result, rerender } = renderHook(
      ({ nav }: { nav: BibleReaderNavigation }) => useConsumedNavigationRequest(nav),
      { initialProps: { nav: navigation } },
    )

    expect(result.current?.reference).toEqual(JOHN_3_16)
    expect(result.current?.reference.verse).toBe(16)

    rerender({ nav: navigation })

    expect(result.current).toBeNull()
  })

  it('does not drop a newer request when an older render has already committed', () => {
    const navigation = createBibleReaderNavigation()
    navigation.request(JOHN_3_16)

    const { result } = renderHook(() => useConsumedNavigationRequest(navigation))

    expect(result.current?.reference).toEqual(JOHN_3_16)

    act(() => {
      navigation.focusReference(ROMANS_8_1)
    })

    expect(result.current?.reference).toEqual(ROMANS_8_1)
    expect(result.current?.shouldFocus).toBe(true)
  })
})
