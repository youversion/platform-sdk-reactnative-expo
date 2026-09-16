import type { BibleReference } from '@youversion/platform-react-native-expo-core'
import { useSyncExternalStore } from 'react'

/**
 * One jump the host asked the reader to make. Verse scroll and focus are
 * stored so a later release can honor them; this release only loads the
 * chapter.
 */
export type BibleReaderNavigationRequest = {
  reference: BibleReference
  showsFullChapter: boolean
  scrollsToVerse: boolean
  shouldFocus: boolean
}

const subscribeNoop = (): (() => void) => () => {}
const snapshotZero = (): number => 0

function copyReference(reference: BibleReference): BibleReference {
  return {
    versionId: reference.versionId,
    bookId: reference.bookId,
    chapter: reference.chapter,
    verse: reference.verse,
  }
}

/**
 * Shared pending-request object a host can create and call before
 * `<BibleReader>` mounts. One pending request; a newer call replaces an older
 * one; the reader consumes it once.
 *
 * ```tsx
 * const navigation = useMemo(() => createBibleReaderNavigation(), [])
 * navigation.request({ versionId: 111, bookId: 'JHN', chapter: 3, verse: 16 })
 * <BibleReader navigation={navigation} />
 * ```
 */
export class BibleReaderNavigation {
  #pending: BibleReaderNavigationRequest | null = null
  #version = 0
  #listeners = new Set<() => void>()

  /**
   * Load this version / book / chapter as a full chapter. Verse fields stay on
   * the pending request for a later scroll/focus pass.
   */
  request(reference: BibleReference): void {
    this.#setPending({
      reference: copyReference(reference),
      showsFullChapter: true,
      scrollsToVerse: false,
      shouldFocus: false,
    })
  }

  /**
   * Same chapter change as {@link BibleReaderNavigation.request} today. Does
   * not dim or scroll. `scrollsToVerse` and `shouldFocus` are stored for a
   * later release.
   */
  focusReference(reference: BibleReference, scrollsToVerse = true): void {
    this.#setPending({
      reference: copyReference(reference),
      showsFullChapter: false,
      scrollsToVerse,
      shouldFocus: true,
    })
  }

  get pendingRequest(): BibleReaderNavigationRequest | null {
    return this.#pending
  }

  subscribe = (onStoreChange: () => void): (() => void) => {
    this.#listeners.add(onStoreChange)
    return () => {
      this.#listeners.delete(onStoreChange)
    }
  }

  getSnapshot = (): number => this.#version

  /**
   * Take the pending request and clear it so a later render cannot apply it
   * again. The reader calls this; hosts do not need to.
   */
  consumePending(): BibleReaderNavigationRequest | null {
    const pending = this.#pending
    this.#pending = null
    return pending
  }

  #setPending(request: BibleReaderNavigationRequest): void {
    this.#pending = request
    this.#version += 1
    for (const listener of this.#listeners) {
      listener()
    }
  }
}

export function createBibleReaderNavigation(): BibleReaderNavigation {
  return new BibleReaderNavigation()
}

/**
 * Subscribe to a navigation object and consume at most one request per
 * version bump. A call before mount still lands on the first reader render.
 */
export function useConsumedNavigationRequest(
  navigation: BibleReaderNavigation | undefined,
): BibleReaderNavigationRequest | null {
  useSyncExternalStore(
    navigation ? navigation.subscribe : subscribeNoop,
    navigation ? navigation.getSnapshot : snapshotZero,
    navigation ? navigation.getSnapshot : snapshotZero,
  )
  if (!navigation) {
    return null
  }
  return navigation.consumePending()
}
