import { ApiClient, getHttpStatus } from '@youversion/platform-core'
import { z } from 'zod'

import { DEFAULT_API_HOST } from '../constants'
import { toMessage } from '../error-message'
import { err, ok } from '../result'
import type {
  ImagesApiError,
  ImagesApiResult,
  ListImagesParams,
  YouVersionImage,
  YouVersionImagePage,
} from './types'

export type CreateImagesApiConfig = {
  appKey: string
  installationId: string
  apiHost?: string
  additionalHeaders?: Record<string, string>
  timeout?: number
}

export type ImagesApi = {
  list: (params: ListImagesParams) => Promise<ImagesApiResult<YouVersionImagePage>>
  get: (imageId: string) => Promise<ImagesApiResult<YouVersionImage>>
}

// Images is not on production yet, so every request uses the beta paths.
const IMAGES_COLLECTION_PATH = '/v1-beta/images'

const LANGUAGE_RANGE_PATTERN = /^(\*|[A-Za-z0-9]{1,8}([-_][A-Za-z0-9]{1,8})*)$/

const imageIdSchema = z.string().trim().min(1)

const listImagesParamsSchema = z.object({
  passageId: z.string().trim().min(1).optional(),
  languageRanges: z.array(z.string().regex(LANGUAGE_RANGE_PATTERN)).min(1).optional(),
  pageSize: z.number().int().min(1).max(99).optional(),
  pageToken: z.string().min(1).optional(),
})

const imageWireSchema = z.object({
  id: z.string(),
  image_url: z.string(),
  passage_id: z.string(),
  attribution: z.string(),
  language_tag: z.string(),
  width: z.number(),
  height: z.number(),
  aspect_ratio: z.number(),
})

const imagePageWireSchema = z.object({
  data: z.array(imageWireSchema),
  next_page_token: z.string().nullable().optional(),
  total_size: z.number().nullable().optional(),
})

type ImageWire = z.infer<typeof imageWireSchema>
type ImagePageWire = z.infer<typeof imagePageWireSchema>

export function createImagesApi(config: CreateImagesApiConfig): ImagesApi {
  const client = new ApiClient({
    appKey: config.appKey,
    apiHost: config.apiHost ?? DEFAULT_API_HOST,
    installationId: config.installationId,
    additionalHeaders: config.additionalHeaders,
    timeout: config.timeout,
  })

  return {
    list(params) {
      return catchAsResult(async () => {
        const { passageId, languageRanges, pageSize, pageToken } =
          listImagesParamsSchema.parse(params)
        const query: Record<string, string | number | string[]> = {}
        if (passageId !== undefined) {
          query.passage_id = passageId
        }
        if (languageRanges !== undefined) {
          query['language_ranges[]'] = [...languageRanges]
        }
        if (pageSize !== undefined) {
          query.page_size = pageSize
        }
        if (pageToken !== undefined) {
          query.page_token = pageToken
        }
        const wire = await client.get<unknown>(IMAGES_COLLECTION_PATH, query)
        return parseImagePage(wire)
      })
    },
    get(imageId) {
      return catchAsResult(async () => {
        const id = imageIdSchema.parse(imageId)
        const wire = await client.get<unknown>(
          `${IMAGES_COLLECTION_PATH}/${encodeURIComponent(id)}`,
        )
        return toImage(parseImage(wire))
      })
    },
  }
}

async function catchAsResult<Value>(run: () => Promise<Value>): Promise<ImagesApiResult<Value>> {
  try {
    return ok(await run())
  } catch (caught) {
    return err(toImagesApiError(caught instanceof Error ? caught : new Error(String(caught))))
  }
}

function toImagesApiError(caught: Error): ImagesApiError {
  const status = getHttpStatus(caught)
  const message = toMessage(caught)

  if (status === 401 || status === 403) {
    return { kind: 'auth', status, message }
  }

  if (status === undefined && isZodError(caught)) {
    return { kind: 'invalid-parameter', message }
  }

  if (status === undefined) {
    return { kind: 'transient', message }
  }

  return { kind: 'transient', status, message }
}

function isZodError(caught: Error): boolean {
  return caught.name === 'ZodError' || caught.name === '$ZodError'
}

function parseImagePage(wire: unknown): YouVersionImagePage {
  if (isEmptyListBody(wire)) {
    return { images: [], nextPageToken: null, totalSize: null }
  }
  const parsed = imagePageWireSchema.safeParse(wire)
  if (!parsed.success) {
    throw new Error('Unexpected images API response')
  }
  return toPage(parsed.data)
}

function parseImage(wire: unknown): ImageWire {
  const parsed = imageWireSchema.safeParse(wire)
  if (!parsed.success) {
    throw new Error('Unexpected images API response')
  }
  return parsed.data
}

function isEmptyListBody(wire: unknown): boolean {
  return wire === undefined || wire === null || wire === ''
}

function toImage(wire: ImageWire): YouVersionImage {
  const { id, image_url, passage_id, attribution, language_tag, width, height, aspect_ratio } = wire
  return {
    id,
    imageUrl: image_url,
    passageId: passage_id,
    attribution,
    languageTag: language_tag,
    width,
    height,
    aspectRatio: aspect_ratio,
  }
}

function toPage(wire: ImagePageWire): YouVersionImagePage {
  const { data, next_page_token, total_size } = wire
  return {
    images: data.map(toImage),
    nextPageToken: nextPageTokenFromWire(next_page_token),
    totalSize: totalSizeFromWire(total_size),
  }
}

function nextPageTokenFromWire(token: string | null | undefined): string | null {
  if (token === undefined || token === null || token === '') {
    return null
  }
  return token
}

function totalSizeFromWire(size: number | null | undefined): number | null {
  if (size === undefined || size === null) {
    return null
  }
  return size
}
