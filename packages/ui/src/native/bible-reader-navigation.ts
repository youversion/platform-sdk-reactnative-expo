import type { BibleReference } from '@youversion/platform-react-native-expo-core'
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'

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

type Subscribe = (onStoreChange: () => void) => () => void

const subscribeNoop: Subscribe = () => () => {}
const snapshotZero = (): number => 0

function copyReference(reference: BibleReference): BibleReference {
  return {
    versionId: reference.versionId,
    bookId: reference.bookId,
    chapter: reference.chapter,
    verse: reference.verse,
  }
}

type ReaderNavigationAccess = {
  subscribe: Subscribe
  getSnapshot: () => number
  peekPending: () => BibleReaderNavigationRequest | null
  consumeCommitted: (version: number) => void
}

const readerAccess = new WeakMap<BibleReaderNavigation, ReaderNavigationAccess>()

function accessFor(navigation: BibleReaderNavigation): ReaderNavigationAccess {
  const access = readerAccess.get(navigation)
  if (!access) {
    throw new Error('BibleReaderNavigation is not initialized')
  }
  return access
}

/**
 * Pending-request object a host can create and call before `<BibleReader>`
 * mounts. Pass one object to one Reader. One pending request; a newer call
 * replaces an older one; the reader consumes it once.
 *
 * ```tsx
 * const navigation = useMemo(() => {
 *   const readerNavigation = createBibleReaderNavigation()
 *   readerNavigation.request({ versionId: 111, bookId: 'JHN', chapter: 3, verse: 16 })
 *   return readerNavigation
 * }, [])
 * <BibleReader navigation={navigation} />
 * ```
 */
export class BibleReaderNavigation {
  #pending: BibleReaderNavigationRequest | null = null
  #version = 0
  #pendingVersion = 0
  #listeners = new Set<() => void>()

  constructor() {
    readerAccess.set(this, {
      subscribe: (onStoreChange) => {
        this.#listeners.add(onStoreChange)
        return () => {
          this.#listeners.delete(onStoreChange)
        }
      },
      getSnapshot: () => this.#version,
      peekPending: () => this.#pending,
      consumeCommitted: (version) => {
        if (this.#pendingVersion !== version) {
          return
        }
        this.#pending = null
      },
    })
  }

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

  #setPending(request: BibleReaderNavigationRequest): void {
    this.#pending = request
    this.#version += 1
    this.#pendingVersion = this.#version
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
 * version bump. Peek during render so a discarded render cannot drop the
 * jump; clear only after commit. A call before mount still lands on the
 * first reader render.
 */
export function useConsumedNavigationRequest(
  navigation: BibleReaderNavigation | undefined,
): BibleReaderNavigationRequest | null {
  let subscribe: Subscribe = subscribeNoop
  let getSnapshot = snapshotZero
  if (navigation) {
    const access = accessFor(navigation)
    subscribe = access.subscribe
    getSnapshot = access.getSnapshot
  }
  const version = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const committedRef = useRef<{
    navigation: BibleReaderNavigation | undefined
    version: number
  }>({ navigation: undefined, version: 0 })

  useLayoutEffect(() => {
    committedRef.current = { navigation, version }
    if (!navigation) {
      return
    }
    accessFor(navigation).consumeCommitted(version)
  }, [navigation, version])

  if (!navigation) {
    return null
  }
  const committedVersion =
    committedRef.current.navigation === navigation ? committedRef.current.version : 0
  if (version === committedVersion) {
    return null
  }
  return accessFor(navigation).peekPending()
}
