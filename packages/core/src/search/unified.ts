import type { SearchClient } from '@youversion/platform-core'

import type {
  SearchUnifiedParams,
  YouVersionImageSearchResult,
  YouVersionSearchUserIntent,
  YouVersionUnifiedSearchField,
  YouVersionUnifiedSearchResults,
} from './types'

type WireValue = string | number | boolean | null

type WireImageHit = {
  id?: WireValue
  passage_id?: WireValue
} | null

type UnifiedSearchOptions = {
  fields?: YouVersionUnifiedSearchField[]
  userIntent?: YouVersionSearchUserIntent
}

type UnifiedSearchCall = {
  query: string
  bibleId: number
  languageRanges: string[]
  options: UnifiedSearchOptions
}

function isWireString(value: WireValue | undefined): value is string {
  return String(value) === value
}

export function buildUnifiedSearchCall(params: SearchUnifiedParams): UnifiedSearchCall {
  const options: UnifiedSearchOptions = {}

  if (params.fields !== undefined) {
    options.fields = params.fields
  }

  if (params.userIntent !== undefined) {
    options.userIntent = params.userIntent
  }

  return {
    query: params.query,
    bibleId: params.bibleId,
    languageRanges: params.languageRanges,
    options,
  }
}

// TODO(YPE-6190): replace local image mapping with SearchClient.searchUnified from @youversion/platform-core once React #446 publishes; then delete mapUnifiedSearchImages, isWireString, WireValue, WireImageHit, and the image cases in unified.test.ts.
export function mapUnifiedSearchImages(
  images: WireImageHit[] | null | undefined,
): YouVersionImageSearchResult[] {
  if (images === undefined || images === null) {
    return []
  }

  const results: YouVersionImageSearchResult[] = []
  for (const image of images) {
    if (image === null) {
      continue
    }
    if (!isWireString(image.id) || !isWireString(image.passage_id)) {
      continue
    }
    results.push({ id: image.id, passageId: image.passage_id })
  }
  return results
}

// TODO(YPE-6190): replace the local stub with SearchClient.searchUnified from @youversion/platform-core once React #446 publishes, then delete requestUnifiedSearch.
export function requestUnifiedSearch(
  _client: SearchClient,
  _call: UnifiedSearchCall,
): Promise<YouVersionUnifiedSearchResults> {
  throw new Error('SearchClient.searchUnified is not published')
}
