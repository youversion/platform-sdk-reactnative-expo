/**
 * Internal UI primitives (see UI Primitives in AGENTS.md). SDK code imports
 * from this barrel; never re-export from `src/index.ts` — the public surface
 * is pinned by `src/__tests__/exports.test.ts`.
 */
export { Text } from './text'
export type { TextProps } from './text'
export { Button } from './button'
export type { ButtonProps } from './button'
