import {
  biblePassageAnchorFromPassageId,
  mmkvStorage,
} from '@youversion/platform-react-native-expo-core'
import { createBibleReaderNavigation } from '@youversion/platform-react-native-expo-ui'
import { useSyncExternalStore } from 'react'

import { READER_LOCATION_KEY, versionIdFromPersistedLocation } from './reader-version'

export const readerNavigation = createBibleReaderNavigation()

function readInitialVersion(): number {
  try {
    return versionIdFromPersistedLocation(mmkvStorage.getString(READER_LOCATION_KEY))
  } catch {
    return versionIdFromPersistedLocation(undefined)
  }
}

let versionId = readInitialVersion()
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function getReaderVersionId(): number {
  return versionId
}

export function setReaderVersionId(next: number): void {
  if (next === versionId) return
  versionId = next
  emit()
}

export function subscribeReaderVersionId(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useReaderVersionId(): number {
  return useSyncExternalStore(subscribeReaderVersionId, getReaderVersionId, getReaderVersionId)
}

/** Ask the Bible tab to open this passage. Returns false when the id is not a passage. */
export function openPassageInReader(passageId: string, versionIdForPassage: number): boolean {
  const anchor = biblePassageAnchorFromPassageId(passageId, versionIdForPassage)
  if (anchor === null) return false
  readerNavigation.focusReference({ ...anchor, passageId })
  return true
}
