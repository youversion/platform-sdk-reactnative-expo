import type {
  BibleContentResponse,
  FetchBibleContent,
} from '@youversion/platform-react-native-expo-core'
import { z } from 'zod'

import type { InternalVersionFilterProps } from '../lib/version-filter-props'
import { isUsableBibleVersion, isVersionIdDecidablyUnusable } from '../lib/version-usability'

const passageMetadataSchema = z.object({
  reference: z.string(),
})

const versionMetadataSchema = z.object({
  localized_abbreviation: z.string().optional(),
  copyright: z.string().nullable().optional(),
  language_tag: z.string().optional(),
})

export type BibleCardMetadata = {
  reference: string | undefined
  abbreviation: string | undefined
  copyright: string | undefined
  languageTag: string | undefined
}

type ParsedVersion = {
  abbreviation: string | undefined
  copyright: string | undefined
  languageTag: string | undefined
}

function referenceFromResponse(response: BibleContentResponse | null): string | undefined {
  if (response == null || response.status < 200 || response.status >= 300) {
    return undefined
  }
  try {
    const passage = passageMetadataSchema.safeParse(JSON.parse(response.body))
    if (!passage.success) {
      return undefined
    }
    return passage.data.reference
  } catch {
    return undefined
  }
}

function versionFromResponse(response: BibleContentResponse | null): ParsedVersion | null {
  if (response == null || response.status < 200 || response.status >= 300) {
    return null
  }
  try {
    const version = versionMetadataSchema.safeParse(JSON.parse(response.body))
    if (!version.success) {
      return null
    }
    return {
      abbreviation: version.data.localized_abbreviation,
      copyright: version.data.copyright ?? undefined,
      languageTag: version.data.language_tag,
    }
  } catch {
    return null
  }
}

/**
 * Human-readable reference, version abbreviation, and copyright for native BibleCard chrome.
 * Uses the Bible Content Client (ADR 0020). Returns `null` when both lookups fail, or when
 * provider version filters refuse the version (same rules as native VOTD share).
 *
 * Internal. Not on the UI or core package barrel.
 */
export async function getBibleCardMetadata(
  fetchBibleContent: FetchBibleContent,
  versionId: number,
  passageId: string,
  filters: InternalVersionFilterProps = {},
): Promise<BibleCardMetadata | null> {
  if (isVersionIdDecidablyUnusable(versionId, filters)) {
    return null
  }
  try {
    const passagePath = `/v1/bibles/${versionId}/passages/${encodeURIComponent(passageId)}?format=text`
    const versionPath = `/v1/bibles/${versionId}`
    if (filters.permittedLanguageTags !== undefined) {
      const versionResponse = await fetchBibleContent({ path: versionPath }).catch(() => null)
      const version = versionFromResponse(versionResponse)
      if (!isUsableBibleVersion({ id: versionId, languageTag: version?.languageTag }, filters)) {
        return null
      }
      const passageResponse = await fetchBibleContent({ path: passagePath }).catch(() => null)
      const reference = referenceFromResponse(passageResponse)
      if (reference == null && version == null) {
        return null
      }
      return {
        reference,
        abbreviation: version?.abbreviation,
        copyright: version?.copyright,
        languageTag: version?.languageTag,
      }
    }
    const [passageResponse, versionResponse] = await Promise.all([
      fetchBibleContent({ path: passagePath }).catch(() => null),
      fetchBibleContent({ path: versionPath }).catch(() => null),
    ])
    const reference = referenceFromResponse(passageResponse)
    const version = versionFromResponse(versionResponse)
    if (reference == null && version == null) {
      return null
    }
    return {
      reference,
      abbreviation: version?.abbreviation,
      copyright: version?.copyright,
      languageTag: version?.languageTag,
    }
  } catch {
    return null
  }
}
