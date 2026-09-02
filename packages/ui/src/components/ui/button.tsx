import { createContext, use, useMemo } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import type { PressableProps, StyleProp, ViewStyle } from 'react-native'

import { useTheme, useTokens } from '../../hooks'
import type { Theme } from '../../hooks'
import { withAlpha } from '../../lib/color'
import { createVariants } from '../../lib/variants'
import type { VariantProps } from '../../lib/variants'
import type { Tokens } from '../../theme'
import { fontMapKey } from '../../theme/fonts'
import { Text } from './text'
import type { TextProps } from './text'

/** Web `[&_svg]:size-6` does not vary by size, so one number covers every step. */
const ICON_SIZE = 24

// Web only defines hover states, which have no touch analog. One opacity for
// every variant keeps the pressed feedback cross-platform and testable.
const PRESSED_OPACITY = 0.8
const DISABLED_OPACITY = 0.5

// Control heights and padding read off the web size ramp (h-8/h-9/h-10,
// px-3/px-4/px-6). Local to Button because only Button uses these numbers.
const SIZES = Object.freeze({
  default: Object.freeze({ height: 36, paddingHorizontal: 16, gap: 8 }),
  sm: Object.freeze({ height: 32, paddingHorizontal: 12, gap: 6 }),
  lg: Object.freeze({ height: 40, paddingHorizontal: 24, gap: 8 }),
  icon: Object.freeze({ height: 36, width: 36, paddingHorizontal: 0, gap: 8 }),
})

const buttonVariants = createVariants((tokens) => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.md,
  },
  variants: {
    variant: {
      default: { backgroundColor: tokens.primary },
      destructive: { backgroundColor: tokens.destructive },
      outline: {
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.background,
      },
      secondary: { backgroundColor: tokens.muted },
      ghost: { backgroundColor: 'transparent' },
      link: { backgroundColor: 'transparent' },
    },
    size: { ...SIZES },
    // Web restyles two variants under `dark:` beyond a token swap. The group
    // runs last so the override wins over the variant it names.
    scheme: {
      none: {},
      darkDestructive: { backgroundColor: withAlpha(tokens.destructive, 0.6) },
      darkOutline: {
        borderColor: tokens.input,
        backgroundColor: withAlpha(tokens.input, 0.3),
      },
    },
  },
  defaultVariants: { variant: 'default', size: 'default', scheme: 'none' },
}))

type ButtonVariantProps = VariantProps<typeof buttonVariants>
type ButtonVariant = NonNullable<ButtonVariantProps['variant']>
type ButtonScheme = NonNullable<ButtonVariantProps['scheme']>

const FOREGROUND_BY_VARIANT: Readonly<Record<ButtonVariant, (tokens: Tokens) => string>> =
  Object.freeze({
    default: (tokens: Tokens) => tokens.primaryForeground,
    // White in both schemes, matching web `text-white`.
    destructive: (tokens: Tokens) => tokens.destructiveForeground,
    outline: (tokens: Tokens) => tokens.foreground,
    secondary: (tokens: Tokens) => tokens.foreground,
    ghost: (tokens: Tokens) => tokens.foreground,
    link: (tokens: Tokens) => tokens.primary,
  })

function resolveScheme(theme: Theme, variant: ButtonVariant): ButtonScheme {
  if (theme !== 'dark') {
    return 'none'
  }
  if (variant === 'destructive') {
    return 'darkDestructive'
  }
  if (variant === 'outline') {
    return 'darkOutline'
  }
  return 'none'
}

const styles = StyleSheet.create({
  pressed: { opacity: PRESSED_OPACITY },
  disabled: { opacity: DISABLED_OPACITY },
})

type ButtonContextValue = {
  readonly foreground: string
  readonly iconSize: number
}

const ButtonContext = createContext<ButtonContextValue | null>(null)

function useButtonContext(): ButtonContextValue {
  const context = use(ButtonContext)
  if (context === null) {
    throw new Error('Button.Icon and Button.Text must be rendered inside <Button>')
  }
  return context
}

export type ButtonProps = Omit<PressableProps, 'style'> &
  Omit<ButtonVariantProps, 'scheme'> & {
    /** Merged last, after the variant styles. Pressable's style-function form is not supported. */
    style?: StyleProp<ViewStyle>
  }

function ButtonRoot({ variant, size, style, disabled, ...props }: ButtonProps): ReactNode {
  const tokens = useTokens()
  const theme = useTheme()
  const resolvedVariant = variant ?? 'default'
  const foreground = FOREGROUND_BY_VARIANT[resolvedVariant](tokens)
  const context = useMemo(() => ({ foreground, iconSize: ICON_SIZE }), [foreground])
  const scheme = resolveScheme(theme, resolvedVariant)

  return (
    <ButtonContext.Provider value={context}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        {...props}
        style={({ pressed }) => [
          buttonVariants(tokens, { variant: resolvedVariant, size, scheme }),
          pressed && styles.pressed,
          disabled === true && styles.disabled,
          style,
        ]}
      />
    </ButtonContext.Provider>
  )
}

export type ButtonIconProps = {
  /** An icon component from `native/icons`, or anything with the same signature. */
  as: ComponentType<{ color: string; size: number }>
  color?: string
  size?: number
}

/** Paints an icon in the root's foreground unless the caller overrides it. */
function ButtonIcon({ as: As, color, size }: ButtonIconProps): ReactNode {
  const context = useButtonContext()
  return <As color={color ?? context.foreground} size={size ?? context.iconSize} />
}

/** The label. `numberOfLines` is the RN analog of web `whitespace-nowrap`. */
function ButtonText({ style, ...props }: TextProps): ReactNode {
  const context = useButtonContext()
  const tokens = useTokens()
  return (
    <Text
      numberOfLines={1}
      {...props}
      style={[
        {
          color: context.foreground,
          fontFamily: fontMapKey(tokens.fontFamily.sans, 500, 'normal'),
          ...tokens.typography.sm,
        },
        style,
      ]}
    />
  )
}

/** Themed button primitive. Internal — see UI Primitives in AGENTS.md. */
export const Button = Object.assign(ButtonRoot, { Icon: ButtonIcon, Text: ButtonText })
