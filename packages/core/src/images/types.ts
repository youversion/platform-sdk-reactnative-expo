import type { Collection } from '@youversion/platform-core'

import type { Result } from '../result'

export type GetImagesOptions = {
  passage_id?: string
  language_ranges?: readonly string[]
  page_size?: number
  page_token?: string | null
}

export type YouVersionImage = {
  id: string
  image_url: string
  passage_id: string
  attribution: string
  language_tag: string
  width: number
  height: number
  aspect_ratio: number
}

export type YouVersionImagePage = Collection<YouVersionImage>

export type ImagesApiError =
  | { kind: 'auth'; status: 401 | 403; message: string }
  | { kind: 'transient'; status?: number; message: string }
  | { kind: 'invalid-parameter'; message: string }

export type ImagesApiResult<Value> = Result<Value, ImagesApiError>
