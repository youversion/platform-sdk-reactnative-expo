import { z } from 'zod'
import { mmkvStorage } from '../storage/mmkv-storage'
import {
  highlightsCacheKey,
  MMKV_HIGHLIGHTS_KEY_PREFIX,
  type HighlightScope,
  type ServerColors,
} from './constants'

export {
  highlightsCacheKey,
  MMKV_HIGHLIGHTS_KEY_PREFIX,
  type HighlightScope,
  type ServerColors,
} from './constants'

const hexColorSchema = z.string().regex(/^[0-9a-f]{6}$/i)

const serverColorsSchema = z.record(z.string(), hexColorSchema).transform((raw, ctx) => {
  const result: ServerColors = {}
  for (const [key, value] of Object.entries(raw)) {
    const verse = Number(key)
    if (!Number.isInteger(verse) || verse <= 0) {
      ctx.addIssue({
        code: 'custom',
        message: `Invalid verse key: ${key}`,
      })
      return z.NEVER
    }
    result[verse] = value.toLowerCase()
  }
  return result
})

function normalizeServerColors(colors: ServerColors): ServerColors {
  const normalized: ServerColors = {}
  for (const [key, value] of Object.entries(colors)) {
    const verse = Number(key)
    normalized[verse] = value.toLowerCase()
  }
  return normalized
}

export function getServerColors(userId: string, scope: HighlightScope): ServerColors | null {
  if (!userId) {
    return null
  }

  try {
    const raw = mmkvStorage.getString(highlightsCacheKey(userId, scope))
    if (raw == null) {
      return null
    }
    const parsed = serverColorsSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

export function setServerColors(userId: string, scope: HighlightScope, colors: ServerColors): void {
  if (!userId) {
    return
  }
  const normalized = normalizeServerColors(colors)
  mmkvStorage.set(highlightsCacheKey(userId, scope), JSON.stringify(normalized))
}

export function clearHighlightsCache(): void {
  for (const key of mmkvStorage.getAllKeys()) {
    if (key.startsWith(MMKV_HIGHLIGHTS_KEY_PREFIX)) {
      mmkvStorage.remove(key)
    }
  }
}
