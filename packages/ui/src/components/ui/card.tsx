import { createContext, use, useMemo } from 'react'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import type { ViewProps } from 'react-native'

import { useTokens } from '../../hooks'
import { createVariants } from '../../lib/variants'
import { Text } from './text'
import type { TextProps } from './text'

// HEADER_GAP is tightened from shadcn's `gap-1.5` (6). FOOTER_GAP follows web's
// dialog action row (`flex justify-end gap-2`) — shadcn's card footer has none.
const PADDING = 24
const GAP = 24
const HEADER_GAP = 2
const FOOTER_GAP = 8

// No border: web's BibleCard and VerseOfTheDay surfaces separate from the page
// by the `card` fill alone. Borders are for inset or interactive surfaces.
const cardVariants = createVariants((tokens) => ({
  base: {
    backgroundColor: tokens.card,
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FOOTER_GAP,
    paddingHorizontal: PADDING,
  },
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
