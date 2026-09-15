import type {
  BibleContentResponse,
  FetchBibleContent,
} from '@youversion/platform-react-native-expo-core'
import type { VerseOfTheDayShareData } from '@youversion/platform-react-ui'
import { z } from 'zod'

import type { InternalVersionFilterProps } from '../lib/version-filter-props'

const passageShareSchema = z.object({
  content: z.string(),
  reference: z.string(),
})

const versionShareSchema = z.object({
  localized_abbreviation: z.string().optional(),
  language_tag: z.string().optional(),
})

type ParsedVersion = {
  abbreviation: string | undefined
  languageTag: string | undefined
}

function versionFromResponse(response: BibleContentResponse | null): ParsedVersion | null {
  if (response == null || response.status < 200 || response.status >= 300) {
    return null
  }
  try {
    const version = versionShareSchema.safeParse(JSON.parse(response.body))
    if (!version.success) {
      return null
    }
    return {
      abbreviation: version.data.localized_abbreviation,
      languageTag: version.data.language_tag,
    }
  } catch {
    return null
  }
}

// Same permit/exclude/language rules as `@youversion/platform-core` version-filters.
// Those functions read `YouVersionPlatformConfiguration`, which this provider
// does not write.
function isVersionIdDecidablyUnusable(
  versionId: number,
  filters: InternalVersionFilterProps,
): boolean {
  const { excludedVersionIds, permittedVersionIds } = filters
  if (excludedVersionIds?.includes(versionId)) {
    return true
  }
  return permittedVersionIds !== undefined && !permittedVersionIds.includes(versionId)
}

function isUsableBibleVersion(
  candidate: { id: number; languageTag?: string },
  filters: InternalVersionFilterProps,
): boolean {
  if (isVersionIdDecidablyUnusable(candidate.id, filters)) {
    return false
  }
  const { permittedLanguageTags } = filters
  if (permittedLanguageTags === undefined) {
    return true
  }
  if (candidate.languageTag === undefined) {
    return false
  }
  return permittedLanguageTags.includes(candidate.languageTag)
}

function shareFromPassage(
  passageResponse: BibleContentResponse,
  parsedVersion: ParsedVersion | null,
): VerseOfTheDayShareData | null {
  if (passageResponse.status < 200 || passageResponse.status >= 300) {
    return null
  }
  const passage = passageShareSchema.safeParse(JSON.parse(passageResponse.body))
  if (!passage.success) {
    return null
  }
  const { content, reference } = passage.data
  const verseText = content.trim()
  const abbreviation = parsedVersion?.abbreviation
  const referenceText = abbreviation ? `${reference} ${abbreviation}` : reference
  const text = referenceText === '' ? verseText : `${verseText}\n\n${referenceText}`
  return { text, reference: referenceText, verseText }
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
  filters: InternalVersionFilterProps = {},
): Promise<VerseOfTheDayShareData | null> {
  if (isVersionIdDecidablyUnusable(versionId, filters)) {
    return null
  }
  try {
    const passagePath = `/v1/bibles/${versionId}/passages/${encodeURIComponent(passageId)}?format=text`
    const versionPath = `/v1/bibles/${versionId}`
    if (filters.permittedLanguageTags !== undefined) {
      const versionResponse = await fetchBibleContent({ path: versionPath }).catch(() => null)
      const parsedVersion = versionFromResponse(versionResponse)
      if (
        !isUsableBibleVersion({ id: versionId, languageTag: parsedVersion?.languageTag }, filters)
      ) {
        return null
      }
      const passageResponse = await fetchBibleContent({ path: passagePath })
      return shareFromPassage(passageResponse, parsedVersion)
    }
    const [passageResponse, versionResponse] = await Promise.all([
      fetchBibleContent({ path: passagePath }),
      fetchBibleContent({ path: versionPath }).catch(() => null),
    ])
    return shareFromPassage(passageResponse, versionFromResponse(versionResponse))
  } catch {
    return null
  }
}
