import { mmkvStorage } from '@youversion/platform-react-native-expo-core'

const QUEUE_PREFIX = 'yvp.highlightqueue.'

/** Park a dummy queue key so `hasQueuedHighlightWrites(userId)` is true. */
export function seedQueuedHighlightWrites(userId: string): void {
  mmkvStorage.set(`${QUEUE_PREFIX}${userId}.111.JHN.1`, '{}')
}
