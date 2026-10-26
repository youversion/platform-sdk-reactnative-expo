import type { Collection, VerseImage } from '@youversion/platform-core'

import type { Result } from '../result'

export type { GetImagesOptions } from '@youversion/platform-core'

export type YouVersionImage = VerseImage

export type YouVersionImagePage = Collection<YouVersionImage>

export type ImagesApiError =
  | { kind: 'auth'; status: 401 | 403; message: string }
  | { kind: 'transient'; status?: number; message: string }
  | { kind: 'invalid-parameter'; message: string }

export type ImagesApiResult<Value> = Result<Value, ImagesApiError>
