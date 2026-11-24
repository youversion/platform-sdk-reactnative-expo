// INTERIM (YPE-6577): replaced by @youversion/platform-core once platform-sdk-react#488 ships. Delete this file when adopting it.
// Mirrors OrganizationIdSchema in packages/core/src/schemas/organization.ts @ c748d1f942bc9089ea2f466b4fdc973687794487.
// RN: platform-core 2.17 does not export this schema, so only the id check is copied.

import * as z from 'zod/mini'

/** Input validation for a caller-supplied organization identifier. */
export const OrganizationIdSchema = z.pipe(
  z.string().check(z.trim()),
  z.uuid({ error: 'Organization ID must be a valid UUID' }),
)
