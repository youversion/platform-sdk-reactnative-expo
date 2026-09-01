import { ApiClient, BibleClient } from '@youversion/platform-core'
import type { YouVersionContextValue } from '@youversion/platform-react-native-expo-core'

import { getSdkHeaders } from '../lib/sdk-version'

const DEFAULT_API_HOST = 'api.youversion.com'

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
 * any failure — callers paint nothing rather than throw. No access token: this
 * is not a user-owned resource.
 *
 * Internal. Not on the UI or core package barrel.
 */
export async function getVerseOfTheDayPassageId(
  credentials: Pick<YouVersionContextValue, 'appKey' | 'apiHost' | 'installationId'>,
  dayOfYear: number,
): Promise<string | null> {
  try {
    const { appKey, apiHost, installationId } = credentials
    const host = apiHost || DEFAULT_API_HOST
    const client = new BibleClient(
      new ApiClient({
        appKey,
        apiHost: host,
        installationId,
        // platform-core stamps ReactSDK=; override with this SDK's stamp (ADR 0012).
        additionalHeaders: getSdkHeaders(),
      }),
    )
    const { passage_id } = await client.getVOTD(dayOfYear)
    if (!passage_id) {
      return null
    }
    return passage_id
  } catch {
    return null
  }
}
