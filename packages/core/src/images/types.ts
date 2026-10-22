import type { Collection } from '@youversion/platform-core'

import type { Result } from '../result'
import type { Image } from './schema'

export type { GetImagesOptions } from './schema'

export type YouVersionImage = Image

export type YouVersionImagePage = Collection<YouVersionImage>

export type ImagesApiError =
  | { kind: 'auth'; status: 401 | 403; message: string }
  | { kind: 'transient'; status?: number; message: string }
  | { kind: 'invalid-parameter'; message: string }

export type ImagesApiResult<Value> = Result<Value, ImagesApiError>
