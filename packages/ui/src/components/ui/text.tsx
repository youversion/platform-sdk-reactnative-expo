import type { ReactNode } from 'react'
import { Text as RNText } from 'react-native'
import type { TextProps as RNTextProps } from 'react-native'

import { useTokens } from '../../hooks'
import { createVariants } from '../../lib/variants'
import type { VariantProps } from '../../lib/variants'
import { fontMapKey } from '../../theme/fonts'

const textVariants = createVariants((tokens) => ({
  base: {
    color: tokens.foreground,
    fontFamily: tokens.fontFamily.sans,
    ...tokens.typography.base,
  },
  variants: {
    variant: {
      body: {},
      muted: { color: tokens.mutedForeground, ...tokens.typography.sm },
      heading: {
        // Bold is a registered face, not a fontWeight — see AGENTS.md.
        fontFamily: fontMapKey(tokens.fontFamily.sans, 700, 'normal'),
        ...tokens.typography.lg,
      },
    },
  },
  defaultVariants: { variant: 'body' },
}))

export type TextProps = RNTextProps & VariantProps<typeof textVariants>

/** Themed text primitive. Internal — see UI Primitives in AGENTS.md. */
export function Text({ variant, style, ...props }: TextProps): ReactNode {
  const tokens = useTokens()
  return <RNText {...props} style={[textVariants(tokens, { variant }), style]} />
}
