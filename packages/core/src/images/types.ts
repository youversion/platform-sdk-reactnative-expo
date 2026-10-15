import type { Result } from '../result'

export type YouVersionImage = {
  id: string
  imageUrl: string
  passageId: string
  attribution: string
  languageTag: string
  width: number
  height: number
  aspectRatio: number
}

export type YouVersionImagePage = {
  images: YouVersionImage[]
  nextPageToken: string | null
  totalSize: number | null
}

export type ListImagesParams = {
  passageId?: string
  languageRanges?: readonly string[]
  pageSize?: number
  pageToken?: string
}

export type ImagesApiError =
  | { kind: 'auth'; status: 401 | 403; message: string }
  | { kind: 'transient'; status?: number; message: string }
  | { kind: 'invalid-parameter'; message: string }

export type ImagesApiResult<Value> = Result<Value, ImagesApiError>
