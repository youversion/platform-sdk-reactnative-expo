import type { ApiClient } from '@youversion/platform-core'
import { z } from 'zod'

import type { GetImagesOptions, YouVersionImage, YouVersionImagePage } from './types'

const LANGUAGE_RANGE = /^(\*|[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*)$/

const languageRangeSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.replace(/_/g, '-').toLowerCase())
  .refine((value) => LANGUAGE_RANGE.test(value))

const listOptionsSchema = z.object({
  passage_id: z.string().trim().min(1).optional(),
  language_ranges: z.array(languageRangeSchema).min(1).optional(),
  page_size: z.number().int().min(1).max(99).optional(),
  page_token: z.string().min(1).nullable().optional(),
})

const imageIdSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0)

const imageSchema = z.object({
  id: z.string(),
  image_url: z.string(),
  passage_id: z.string(),
  attribution: z.string(),
  language_tag: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  aspect_ratio: z.number(),
})

const pageSchema = z.object({
  data: z.array(z.unknown()),
  next_page_token: z.string().nullable().optional(),
  total_size: z.number().int().nonnegative().nullable().optional(),
})

type ImagesQuery = Record<string, string | number | string[]>

// Temporary stand-in until `@youversion/platform-core` publishes an `ImagesClient`.
export class ImagesClient {
  private client: ApiClient

  constructor(client: ApiClient) {
    this.client = client
  }

  async getImages(options: GetImagesOptions = {}): Promise<YouVersionImagePage> {
    const parsed = listOptionsSchema.parse(options)
    const query: ImagesQuery = {}

    if (parsed.passage_id !== undefined) {
      query.passage_id = parsed.passage_id
    }
    if (parsed.language_ranges !== undefined) {
      query['language_ranges[]'] = parsed.language_ranges
    }
    if (parsed.page_size !== undefined) {
      query.page_size = parsed.page_size
    }
    if (parsed.page_token != null) {
      query.page_token = parsed.page_token
    }

    const body = await this.client.get<unknown>('/v1/images', query)
    if (body === '' || body == null) {
      return { data: [], next_page_token: null }
    }
    const page = pageSchema.safeParse(body)
    if (!page.success) {
      throw new Error(`Unexpected images API response: ${page.error.message}`)
    }
    return toImagePage(page.data)
  }

  async getImage(imageId: string): Promise<YouVersionImage> {
    const id = imageIdSchema.parse(imageId)
    const body = await this.client.get<unknown>(`/v1/images/${encodeURIComponent(id)}`)
    const parsed = imageSchema.safeParse(body)
    if (!parsed.success) {
      throw new Error(`Unexpected images API response: ${parsed.error.message}`)
    }
    return parsed.data
  }
}

type ImagePageWire = z.infer<typeof pageSchema>

function toImagePage(wire: ImagePageWire): YouVersionImagePage {
  const data: YouVersionImage[] = []
  for (const item of wire.data) {
    const image = imageSchema.safeParse(item)
    if (image.success) {
      data.push(image.data)
    }
  }

  const token = wire.next_page_token
  const page: YouVersionImagePage = {
    data,
    next_page_token: token == null || token === '' ? null : token,
  }
  if (wire.total_size == null) {
    return page
  }
  return { ...page, total_size: wire.total_size }
}
