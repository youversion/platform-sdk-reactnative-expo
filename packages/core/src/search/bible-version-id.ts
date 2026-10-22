import * as z from 'zod/mini'

/** Input validation for a Bible version identifier. */
export const BibleVersionIdSchema = z
  .int()
  .check(z.positive('Version ID must be a positive integer'))
