/**
 * Internal UI primitives (see UI Primitives in AGENTS.md). SDK code imports
 * from this barrel; never re-export from `src/index.ts` — the public surface
 * is pinned by `src/__tests__/exports.test.ts`.
 */
export { Text, type TextProps } from './text'
export { Button, type ButtonIconProps, type ButtonProps, type ButtonTextProps } from './button'
export {
  Avatar,
  type AvatarFallbackProps,
  type AvatarImageProps,
  type AvatarProps,
} from './avatar'
export {
  Card,
  type CardContentProps,
  type CardFooterProps,
  type CardHeaderProps,
  type CardProps,
  type CardTextProps,
  type CardTitleProps,
} from './card'
export {
  Tabs,
  type TabsContentProps,
  type TabsListProps,
  type TabsProps,
  type TabsTextProps,
  type TabsTriggerProps,
} from './tabs'
export {
  Accordion,
  type AccordionContentProps,
  type AccordionItemProps,
  type AccordionProps,
  type AccordionTextProps,
  type AccordionTriggerProps,
} from './accordion'
export {
  Popover,
  type PopoverCloseProps,
  type PopoverContentProps,
  type PopoverProps,
  type PopoverTextProps,
  type PopoverTriggerProps,
} from './popover'
