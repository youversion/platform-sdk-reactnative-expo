import { z } from 'zod'

import { fontFamily } from './scales'

export const DEFAULT_API_HOST = 'api.youversion.com'

export const UNTITLED_SERIF_FONT_ID = 1

/** Hosts named in YPE-5266 / web ADR 0004. Font.loadAsync fetches whatever URI we pass. */
const ALLOWED_FONT_FILE_HOSTS = new Set(['api.youversion.com', 'cdn.youversion.com'])

const fontWeightSchema = z.union([z.literal(400), z.literal(500), z.literal(700)])
const fontStyleSchema = z.enum(['normal', 'italic'])

const fontSourceSchema = z.object({
  format: z.enum(['woff2', 'ttf']),
  url: z.url(),
})

const fontVariantSchema = z.object({
  weight: fontWeightSchema,
  style: fontStyleSchema,
  sources: z.array(fontSourceSchema),
})

const fontSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  family: z.literal(fontFamily.serif),
  variants: z.array(fontVariantSchema),
})

export type FontFace = {
  family: string
  weight: z.infer<typeof fontWeightSchema>
  style: z.infer<typeof fontStyleSchema>
  uri: string
}

export type UntitledSerifFont = z.infer<typeof fontSchema>

export type FetchUntitledSerifFontArgs = {
  appKey: string
  apiHost?: string
}

/**
 * Android finds extra faces as `{family}_{weight}_{style}`.
 * Examples are `Untitled Serif_bold` and `Untitled Serif_italic`.
 * The regular 400 normal face stays the API family name.
 * As a result, the tokens `fontFamily.serif` and `fontFamily.sans` resolve.
 */
export function fontMapKey(
  family: string,
  weight: FontFace['weight'],
  style: FontFace['style'],
): string {
  const parts: string[] = [family]
  if (weight === 500) {
    parts.push('medium')
  } else if (weight === 700) {
    parts.push('bold')
  }
  if (style === 'italic') {
    parts.push('italic')
  }
  if (parts.length === 1) {
    return family
  }
  return parts.join('_')
}

function isAllowedFontFileUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') {
    return false
  }
  return ALLOWED_FONT_FILE_HOSTS.has(parsed.hostname.toLowerCase())
}

export function pickTtfSources(font: UntitledSerifFont): FontFace[] {
  const faces: FontFace[] = []
  for (const variant of font.variants) {
    const ttf = variant.sources.find((source) => source.format === 'ttf')
    if (!ttf) {
      continue
    }
    if (!isAllowedFontFileUrl(ttf.url)) {
      continue
    }
    faces.push({
      family: font.family,
      weight: variant.weight,
      style: variant.style,
      uri: ttf.url,
    })
  }
  return faces
}

export type BrandFontUriMap = {
  [registeredFamily: string]: { uri: string }
}

export function buildFontMap(faces: readonly FontFace[]): BrandFontUriMap {
  return Object.fromEntries(
    faces.map((face) => [fontMapKey(face.family, face.weight, face.style), { uri: face.uri }]),
  )
}

export async function fetchUntitledSerifFont(
  args: FetchUntitledSerifFontArgs,
): Promise<UntitledSerifFont | null> {
  const appKey = args.appKey.trim()
  if (!appKey) {
    return null
  }

  let host = DEFAULT_API_HOST
  if (args.apiHost) {
    const trimmedHost = args.apiHost.trim()
    if (trimmedHost) {
      host = trimmedHost
    }
  }

  const response = await fetch(`https://${host}/v1/fonts/${UNTITLED_SERIF_FONT_ID}`, {
    headers: {
      Accept: 'application/json',
      'X-YVP-App-Key': appKey,
    },
  })

  if (!response.ok) {
    throw new Error(`Fonts API returned ${response.status}`)
  }

  const parsed = fontSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new Error('Fonts API returned an unexpected payload')
  }

  return parsed.data
}
