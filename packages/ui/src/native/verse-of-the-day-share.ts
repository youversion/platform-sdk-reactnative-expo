import type { FetchBibleContent } from '@youversion/platform-react-native-expo-core'
import type { VerseOfTheDayShareData } from '@youversion/platform-react-ui'
import { z } from 'zod'

const passageShareSchema = z.object({
  content: z.string(),
  reference: z.string(),
})

const versionAbbreviationSchema = z.object({
  localized_abbreviation: z.string().optional(),
})

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
      fetchBibleContent({ path: versionPath }),
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
    let referenceText = reference
    if (versionResponse.status >= 200 && versionResponse.status < 300) {
      const version = versionAbbreviationSchema.safeParse(JSON.parse(versionResponse.body))
      if (version.success) {
        const { localized_abbreviation } = version.data
        if (localized_abbreviation) {
          referenceText = `${reference} ${localized_abbreviation}`
        }
      }
    }
    const text = referenceText === '' ? verseText : `${verseText}\n\n${referenceText}`
    return { text, reference: referenceText, verseText }
  } catch {
    return null
  }
}
