import { BibleClient } from '@youversion/platform-core'
import type { YouVersionContextValue } from '@youversion/platform-react-native-expo-core'
import { createApiClient } from '@youversion/platform-react-native-expo-core/api-client'

/**
 * Copied from `@youversion/platform-react-hooks` `getDayOfYear` so native VOTD
 * paint uses the same local calendar day as the Web SDK card. Do not invent a
 * different day-of-year.
 *
 * Internal. Not on the UI or core package barrel.
 */
export function getDayOfYear(date: Date): number {
  return Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)
}

/**
 * Looks up the VOTD `passage_id` for a pinned `dayOfYear`. Returns `null` on
 * failure so the native lookup hook exposes its failed state and retry control.
 * No access token is needed for this app-key resource.
 *
 * Internal. Not on the UI or core package barrel.
 */
export async function getVerseOfTheDayPassageId(
  credentials: Pick<YouVersionContextValue, 'appKey' | 'apiHost' | 'installationId'>,
  dayOfYear: number,
): Promise<string | null> {
  try {
    const { appKey, apiHost, installationId } = credentials
    const client = new BibleClient(createApiClient({ appKey, apiHost, installationId }))
    const { passage_id } = await client.getVOTD(dayOfYear)
    if (!passage_id) {
      return null
    }
    return passage_id
  } catch {
    return null
  }
}
