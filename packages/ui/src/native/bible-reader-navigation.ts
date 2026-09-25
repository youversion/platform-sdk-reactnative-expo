import type { BibleReference } from '@youversion/platform-react-native-expo-core'
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'

/**
 * One jump the host asked the reader to make. Chapter fields drive the
 * location. Verse focus crosses the DOM bridge as {@link BibleReaderVerseFocus}.
 */
export type BibleReaderNavigationRequest = {
  reference: BibleReference
  showsFullChapter: boolean
  scrollsToVerse: boolean
  shouldFocus: boolean
}

/**
 * JSON-safe verse focus. Mount value never focuses. `seq` increases only
 * when {@link BibleReaderNavigation.focusReference} runs, including a repeat.
 */
export type BibleReaderVerseFocus = {
  seq: number
  versionId: number
  passageId: string
  scrollsToVerse: boolean
  shouldFocus: boolean
}

/** A chapter reference, plus the original USFM when the caller still has it. */
export type BibleReaderFocusTarget = BibleReference & {
  passageId?: string
}

const idleVerseFocus: BibleReaderVerseFocus = {
  seq: 0,
  versionId: 0,
  passageId: '',
  scrollsToVerse: false,
  shouldFocus: false,
}

function passageIdFromTarget(reference: BibleReaderFocusTarget): string {
  if (reference.passageId !== undefined && reference.passageId !== '') {
    return reference.passageId
  }
  if (reference.verse === undefined) {
    return `${reference.bookId}.${reference.chapter}`
  }
  return `${reference.bookId}.${reference.chapter}.${reference.verse}`
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
  getVerseFocus: () => BibleReaderVerseFocus
  getAppliedFocusSeq: () => number
  acknowledgeVerseFocus: (seq: number) => void
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
  #focusSeq = 0
  #verseFocus: BibleReaderVerseFocus = idleVerseFocus
  // Highest seq a DOM instance has reported. It stays on this object so a
  // Reader remount does not replay it, and it stays 0 until that report so a
  // focus that arrives while the WebView is loading still runs.
  #appliedFocusSeq = 0
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
      getVerseFocus: () => this.#verseFocus,
      getAppliedFocusSeq: () => this.#appliedFocusSeq,
      acknowledgeVerseFocus: (seq) => {
        if (seq <= this.#appliedFocusSeq) {
          return
        }
        this.#appliedFocusSeq = seq
        this.#notify()
      },
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
   * Load this version / book / chapter as a full chapter. Does not bump the
   * focus `seq` and does not ask the reader to focus.
   */
  request(reference: BibleReference): void {
    const copied = copyReference(reference)
    this.#verseFocus = {
      seq: this.#focusSeq,
      versionId: copied.versionId,
      passageId: passageIdFromTarget(copied),
      scrollsToVerse: false,
      shouldFocus: false,
    }
    this.#setPending({
      reference: copied,
      showsFullChapter: true,
      scrollsToVerse: false,
      shouldFocus: false,
    })
  }

  /**
   * Load this chapter and focus `passageId`. Every call bumps `seq`, including
   * a repeat of the same verse. A caller-supplied `passageId` is kept as-is.
   */
  focusReference(reference: BibleReaderFocusTarget, scrollsToVerse = true): void {
    const copied = copyReference(reference)
    this.#focusSeq += 1
    this.#verseFocus = {
      seq: this.#focusSeq,
      versionId: copied.versionId,
      passageId: passageIdFromTarget(reference),
      scrollsToVerse,
      shouldFocus: true,
    }
    this.#setPending({
      reference: copied,
      showsFullChapter: false,
      scrollsToVerse,
      shouldFocus: true,
    })
  }

  #setPending(request: BibleReaderNavigationRequest): void {
    this.#pending = request
    this.#version += 1
    this.#pendingVersion = this.#version
    this.#notify()
  }

  #notify(): void {
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

/** Latest verse focus for this navigation object. Stable until the next call. */
export function useBibleReaderVerseFocus(navigation: BibleReaderNavigation): BibleReaderVerseFocus {
  const access = accessFor(navigation)
  return useSyncExternalStore(access.subscribe, access.getVerseFocus, access.getVerseFocus)
}

/** Highest verse-focus seq this navigation object has already applied. */
export function useBibleReaderAppliedFocusSeq(navigation: BibleReaderNavigation): number {
  const access = accessFor(navigation)
  return useSyncExternalStore(
    access.subscribe,
    access.getAppliedFocusSeq,
    access.getAppliedFocusSeq,
  )
}

/** Record that the DOM finished this seq. A lower or equal seq is ignored. */
export function acknowledgeBibleReaderVerseFocus(
  navigation: BibleReaderNavigation,
  seq: number,
): void {
  accessFor(navigation).acknowledgeVerseFocus(seq)
}
