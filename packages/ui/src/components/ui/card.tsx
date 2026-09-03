import { createContext, use, useMemo } from 'react'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import type { ViewProps } from 'react-native'

import { useTokens } from '../../hooks'
import { createVariants } from '../../lib/variants'
import { Text } from './text'
import type { TextProps } from './text'

// shadcn `py-6 gap-6` / `px-6` / header `gap-1.5` at 4dp per spacing unit;
// the web SDK's own card surfaces sit on the same `p-6`. Local to Card, as
// Button's SIZES are to Button.
const PADDING = 24
const GAP = 24
const HEADER_GAP = 6

const cardVariants = createVariants((tokens) => ({
  base: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radius.surface,
    paddingVertical: PADDING,
    gap: GAP,
  },
}))

// Vertical padding lives on the root and horizontal on each slot, as shadcn
// splits it, so one slot can go full-bleed with `paddingHorizontal: 0`.
const styles = StyleSheet.create({
  header: { paddingHorizontal: PADDING, gap: HEADER_GAP },
  content: { paddingHorizontal: PADDING },
  footer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: PADDING },
})

type CardContextValue = {
  readonly foreground: string
}

const CardContext = createContext<CardContextValue | null>(null)

function useCardContext(): CardContextValue {
  const context = use(CardContext)
  if (context === null) {
    throw new Error(
      'Card.Header, Card.Title, Card.Content and Card.Footer must be rendered inside <Card>',
    )
  }
  return context
}

export type CardProps = ViewProps

/** Themed surface. `style` merges after the surface styles. */
function CardRoot({ style, ...props }: CardProps): ReactNode {
  const tokens = useTokens()
  const context = useMemo(() => ({ foreground: tokens.cardForeground }), [tokens.cardForeground])

  return (
    <CardContext.Provider value={context}>
      <View {...props} style={[cardVariants(tokens), style]} />
    </CardContext.Provider>
  )
}

export type CardHeaderProps = ViewProps

function CardHeader({ style, ...props }: CardHeaderProps): ReactNode {
  useCardContext()
  return <View {...props} style={[styles.header, style]} />
}

/** `variant` is omitted: the root owns the color and the title pins `heading`
 * below, so a forwarded value cannot restyle it at runtime either. */
export type CardTitleProps = Omit<TextProps, 'variant'>

function CardTitle({ style, ...props }: CardTitleProps): ReactNode {
  const context = useCardContext()
  return (
    <Text
      accessibilityRole="header"
      {...props}
      variant="heading"
      style={[{ color: context.foreground }, style]}
    />
  )
}

export type CardContentProps = ViewProps

function CardContent({ style, ...props }: CardContentProps): ReactNode {
  useCardContext()
  return <View {...props} style={[styles.content, style]} />
}

export type CardFooterProps = ViewProps

function CardFooter({ style, ...props }: CardFooterProps): ReactNode {
  useCardContext()
  return <View {...props} style={[styles.footer, style]} />
}

/** Themed card primitive. Internal — see UI Primitives in AGENTS.md. */
export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Title: CardTitle,
  Content: CardContent,
  Footer: CardFooter,
})
