import type {
  BibleContentResponse,
  FetchBibleContent,
} from '@youversion/platform-react-native-expo-core'
import type { VerseOfTheDayShareData } from '@youversion/platform-react-ui'
import { z } from 'zod'

const passageShareSchema = z.object({
  content: z.string(),
  reference: z.string(),
})

const versionAbbreviationSchema = z.object({
  localized_abbreviation: z.string().optional(),
})

function abbreviationFromVersion(response: BibleContentResponse | null): string | undefined {
  if (response == null || response.status < 200 || response.status >= 300) {
    return undefined
  }
  try {
    const version = versionAbbreviationSchema.safeParse(JSON.parse(response.body))
    if (!version.success) {
      return undefined
    }
    return version.data.localized_abbreviation
  } catch {
    return undefined
  }
}

/**
 * Plain-text passage + version abbreviation for native VOTD chrome and Share.
 * Uses the Bible Content Client (ADR 0020) — not platform-core's BibleClient.
 * Returns `null` on any failure so share no-ops instead of throwing.
 *
 * Internal. Not on the UI or core package barrel.
 */
export async function getVerseOfTheDayShareSource(
  fetchBibleContent: FetchBibleContent,
  versionId: number,
  passageId: string,
): Promise<VerseOfTheDayShareData | null> {
  try {
    const passagePath = `/v1/bibles/${versionId}/passages/${encodeURIComponent(passageId)}?format=text`
    const versionPath = `/v1/bibles/${versionId}`
    const [passageResponse, versionResponse] = await Promise.all([
      fetchBibleContent({ path: passagePath }),
      fetchBibleContent({ path: versionPath }).catch(() => null),
    ])
    if (passageResponse.status < 200 || passageResponse.status >= 300) {
      return null
    }
    const passage = passageShareSchema.safeParse(JSON.parse(passageResponse.body))
    if (!passage.success) {
      return null
    }
    const { content, reference } = passage.data
    const verseText = content.trim()
    const abbreviation = abbreviationFromVersion(versionResponse)
    const referenceText = abbreviation ? `${reference} ${abbreviation}` : reference
    const text = referenceText === '' ? verseText : `${verseText}\n\n${referenceText}`
    return { text, reference: referenceText, verseText }
  } catch {
    return null
  }
}
