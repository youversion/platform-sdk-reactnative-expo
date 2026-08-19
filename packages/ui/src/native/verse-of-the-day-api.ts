import { ApiClient, BibleClient } from '@youversion/platform-core'
import type { YouVersionContextValue } from '@youversion/platform-react-native-expo-core'

const DEFAULT_API_HOST = 'api.youversion.com'

/**
 * Copied from `@youversion/platform-react-hooks` `getDayOfYear` so native VOTD
 * paint uses the same local calendar day as the Web SDK card. Do not invent a
 * different day-of-year.
 */
function getDayOfYear(date: Date): number {
  return Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)
}

/**
 * Looks up today's VOTD `passage_id`. Returns `null` on any failure — callers
 * paint nothing rather than throw. No access token: this is not a user-owned
 * resource.
 *
 * Internal. Not on the UI or core package barrel.
 */
export async function getVerseOfTheDayPassageId(
  credentials: YouVersionContextValue,
): Promise<string | null> {
  try {
    const { appKey, apiHost, installationId } = credentials
    const host = apiHost || DEFAULT_API_HOST
    const client = new BibleClient(
      new ApiClient({
        appKey,
        apiHost: host,
        installationId,
      }),
    )
    const { passage_id } = await client.getVOTD(getDayOfYear(new Date()))
    if (!passage_id) {
      return null
    }
    return passage_id
  } catch {
    return null
  }
}
