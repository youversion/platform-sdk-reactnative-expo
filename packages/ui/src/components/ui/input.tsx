import { createContext, use, useMemo } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import type { PressableProps, StyleProp, TextInputProps, ViewStyle } from 'react-native'

import { useTokens } from '../../hooks'
import { createVariants } from '../../lib/variants'
import { sansFace } from '../../theme/fonts'
import { Text } from './text'

const PRESSED_OPACITY = 0.8
const DISABLED_OPACITY = 0.5
const ICON_SIZE = 24

const inputVariants = createVariants((tokens) => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.input,
    borderColor: tokens.border,
    borderWidth: 1,
    borderRadius: tokens.radius.full,
    paddingHorizontal: 16,
    minHeight: 40,
    gap: 8,
  },
}))

const styles = StyleSheet.create({
  field: {
    flex: 1,
    paddingVertical: 8,
    margin: 0,
  },
  clear: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
  },
  pressed: { opacity: PRESSED_OPACITY },
  disabled: { opacity: DISABLED_OPACITY },
})

type InputContextValue = {
  readonly foreground: string
  readonly placeholderColor: string
  readonly iconColor: string
  readonly iconSize: number
  readonly disabled: boolean
}

const InputContext = createContext<InputContextValue | null>(null)

function useInputContext(): InputContextValue {
  const context = use(InputContext)
  if (context === null) {
    throw new Error('Input.Field, Input.Icon, and Input.Clear must be rendered inside <Input>')
  }
  return context
}

export type InputProps = {
  children?: ReactNode
  disabled?: boolean
  testID?: string
  /** Merged after the variant styles, but not over the disabled ones. */
  style?: StyleProp<ViewStyle>
}

function InputRoot({ children, disabled = false, style, testID }: InputProps): ReactNode {
  const tokens = useTokens()
  const context = useMemo(
    () => ({
      foreground: tokens.foreground,
      placeholderColor: tokens.mutedForeground,
      iconColor: tokens.mutedForeground,
      iconSize: ICON_SIZE,
      disabled,
    }),
    [tokens.foreground, tokens.mutedForeground, disabled],
  )

  return (
    <InputContext.Provider value={context}>
      <View
        testID={testID}
        style={[inputVariants(tokens), style, disabled ? styles.disabled : undefined]}
        accessibilityState={{ disabled }}
      >
        {children}
      </View>
    </InputContext.Provider>
  )
}

export type InputFieldProps = Omit<TextInputProps, 'style'> & {
  style?: TextInputProps['style']
}

function InputField({
  editable,
  placeholderTextColor,
  style,
  ...props
}: InputFieldProps): ReactNode {
  const context = useInputContext()
  const tokens = useTokens()
  const isEditable = editable ?? !context.disabled

  return (
    <TextInput
      {...props}
      editable={isEditable}
      placeholderTextColor={placeholderTextColor ?? context.placeholderColor}
      style={[
        styles.field,
        {
          color: context.foreground,
          ...sansFace(tokens.fontFamily.sans, 400),
          ...tokens.typography.base,
        },
        style,
      ]}
    />
  )
}

export type InputIconProps = {
  /** An icon component from `native/icons`, or anything with the same signature. */
  as: ComponentType<{ color: string; size: number }>
  color?: string
  size?: number
}

/** Paints an icon in the root muted color unless the caller overrides it. */
function InputIcon({ as: As, color, size }: InputIconProps): ReactNode {
  const context = useInputContext()
  return <As color={color ?? context.iconColor} size={size ?? context.iconSize} />
}

export type InputClearProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>
}

function InputClear({ disabled, onPress, style, ...props }: InputClearProps): ReactNode {
  const context = useInputContext()
  const tokens = useTokens()
  const isDisabled = disabled ?? context.disabled

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.clear,
        style,
        pressed && styles.pressed,
        isDisabled ? styles.disabled : undefined,
      ]}
    >
      <Text style={{ color: tokens.mutedForeground, ...tokens.typography.sm }}>×</Text>
    </Pressable>
  )
}

/** Themed text field. Internal — see UI Primitives in AGENTS.md. */
export const Input = Object.assign(InputRoot, {
  Field: InputField,
  Icon: InputIcon,
  Clear: InputClear,
})
