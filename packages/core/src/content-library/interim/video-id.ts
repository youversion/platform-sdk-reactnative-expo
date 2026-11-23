// INTERIM (YPE-6577): replaced by @youversion/platform-core once platform-sdk-react#488 ships. Delete this file when adopting it.
// Mirrors packages/core/src/schemas/video-id.ts @ c748d1f942bc9089ea2f466b4fdc973687794487.

import * as z from 'zod/mini'

function isUriComponentEncodable(value: string): boolean {
  try {
    encodeURIComponent(value)
    return true
  } catch {
    return false
  }
}

/** Opaque video id that can safely occupy one URL path segment. */
export const VideoIdSchema = z.string().check(
  z.refine((value) => value.trim().length > 0, 'Video ID must be a non-empty string'),
  z.refine((value) => value !== '.' && value !== '..', 'Video ID must not be a URL dot segment'),
  z.refine(isUriComponentEncodable, 'Video ID must contain valid Unicode'),
)
