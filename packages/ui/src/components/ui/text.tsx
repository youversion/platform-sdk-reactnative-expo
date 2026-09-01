import type { ReactNode } from 'react'
import { Text as RNText } from 'react-native'
import type { TextProps as RNTextProps } from 'react-native'

import { useTokens } from '../../hooks'
import { createVariants } from '../../lib/variants'
import type { VariantProps } from '../../lib/variants'
import { fontMapKey } from '../../theme/fonts'

// Sizes are web text-sm/base/lg at 16dp per rem. Promote to a typography
// token scale once a second component needs the steps.
const textVariants = createVariants((tokens) => ({
  base: {
    color: tokens.foreground,
    fontFamily: tokens.fontFamily.sans,
    fontSize: 16,
    lineHeight: 24,
  },
  variants: {
    variant: {
      body: {},
      muted: { color: tokens.mutedForeground, fontSize: 14, lineHeight: 20 },
      heading: {
        // Bold is a registered face, not a fontWeight — see AGENTS.md.
        fontFamily: fontMapKey(tokens.fontFamily.sans, 700, 'normal'),
        fontSize: 18,
        lineHeight: 28,
      },
    },
  },
  defaultVariants: { variant: 'body' },
}))

export type TextProps = RNTextProps & VariantProps<typeof textVariants>

/** Themed text primitive. Internal — see UI Primitives in AGENTS.md. */
export function Text({ variant, style, ...rest }: TextProps): ReactNode {
  const tokens = useTokens()
  return <RNText {...rest} style={[textVariants(tokens, { variant }), style]} />
}
