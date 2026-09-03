import type { ReactNode } from 'react'
import { Text as RNText } from 'react-native'
import type { TextProps as RNTextProps } from 'react-native'

import { useBrandFontsReady, useTokens } from '../../hooks'
import { createVariants } from '../../lib/variants'
import type { VariantProps } from '../../lib/variants'
import { sansFace } from '../../theme/fonts'

const textVariants = createVariants((tokens) => ({
  base: {
    color: tokens.foreground,
    ...tokens.typography.base,
  },
  variants: {
    variant: {
      body: {},
      muted: { color: tokens.mutedForeground, ...tokens.typography.sm },
      heading: { ...tokens.typography.lg },
    },
  },
  defaultVariants: { variant: 'body' },
}))

export type TextProps = RNTextProps & VariantProps<typeof textVariants>

type TextVariant = NonNullable<TextProps['variant']>

// The face is resolved outside the variants: which family (or system
// weight) applies depends on whether the brand faces have registered.
const WEIGHT_BY_VARIANT = { body: 400, muted: 400, heading: 700 } satisfies Record<
  TextVariant,
  400 | 700
>

/** Themed text primitive. Internal — see UI Primitives in AGENTS.md. */
export function Text({ variant, style, ...props }: TextProps): ReactNode {
  const tokens = useTokens()
  const ready = useBrandFontsReady()
  const weight = WEIGHT_BY_VARIANT[variant ?? 'body']
  return (
    <RNText
      {...props}
      style={[
        textVariants(tokens, { variant }),
        sansFace(tokens.fontFamily.sans, weight, ready),
        style,
      ]}
    />
  )
}
