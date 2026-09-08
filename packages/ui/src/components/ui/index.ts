/**
 * Internal UI primitives (see UI Primitives in AGENTS.md). SDK code imports
 * from this barrel; never re-export from `src/index.ts` — the public surface
 * is pinned by `src/__tests__/exports.test.ts`.
 */
export { Text, type TextProps } from './text'
export { Button, type ButtonIconProps, type ButtonProps, type ButtonTextProps } from './button'
export { Input, type InputClearProps, type InputFieldProps, type InputProps } from './input'
export {
  Card,
  type CardContentProps,
  type CardFooterProps,
  type CardHeaderProps,
  type CardProps,
  type CardTextProps,
  type CardTitleProps,
} from './card'
