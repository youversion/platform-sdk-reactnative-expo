import type { Collection, GetImagesOptions, Image } from '@youversion/platform-core'

import type { Result } from '../result'

export type { GetImagesOptions }

export type YouVersionImage = Image
export type YouVersionImagePage = Collection<Image>

export type ImagesApiError =
  | { kind: 'auth'; status: 401 | 403; message: string }
  | { kind: 'transient'; status?: number; message: string }
  | { kind: 'invalid-parameter'; message: string }

export type ImagesApiResult<Value> = Result<Value, ImagesApiError>
