import { ApiClient, BibleClient } from '@youversion/platform-core'

import { DEFAULT_API_HOST } from '../constants'
import type { YouVersionContextValue } from '../youversion-context'

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
 * Internal. Same rule as `createHighlightsApi` — not on the package barrel.
 */
export async function getVerseOfTheDayPassageId(
  credentials: YouVersionContextValue,
): Promise<string | null> {
  try {
    const client = new BibleClient(
      new ApiClient({
        appKey: credentials.appKey,
        apiHost: credentials.apiHost || DEFAULT_API_HOST,
        installationId: credentials.installationId,
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
