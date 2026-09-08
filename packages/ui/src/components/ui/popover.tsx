import { createContext, use, useMemo } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import * as PopoverPrimitive from '@rn-primitives/popover'
import { StyleSheet } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'

import { useTokens } from '../../hooks'
import { createVariants } from '../../lib/variants'
import { Text } from './text'
import type { TextProps } from './text'

const CONTENT_WIDTH = 288
const CONTENT_PADDING = 16
const CONTENT_RADIUS = 6
const CONTENT_SIDE_OFFSET = 4

const popoverContentVariants = createVariants((tokens) => ({
  base: {
    width: CONTENT_WIDTH,
    padding: CONTENT_PADDING,
    borderRadius: CONTENT_RADIUS,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.popover,
    shadowColor: tokens.foreground,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
}))

type PopoverContentContextValue = {
  readonly foreground: string
}

const PopoverContentContext = createContext<PopoverContentContextValue | null>(null)

function usePopoverContentContext(): PopoverContentContextValue {
  const context = use(PopoverContentContext)
  if (context === null) {
    throw new Error('Popover.Text must be rendered inside <Popover.Content>')
  }
  return context
}

export type PopoverProps = Omit<PopoverPrimitive.RootProps, 'style'> & {
  style?: StyleProp<ViewStyle>
}

function PopoverRoot({ style, ...props }: PopoverProps): ReactNode {
  return <PopoverPrimitive.Root {...props} style={style} />
}

export type PopoverTriggerProps = Omit<ComponentProps<typeof PopoverPrimitive.Trigger>, 'style'> & {
  style?: StyleProp<ViewStyle>
}

function PopoverTrigger({ style, ...props }: PopoverTriggerProps): ReactNode {
  return <PopoverPrimitive.Trigger {...props} style={style} />
}

export type PopoverContentProps = Omit<PopoverPrimitive.ContentProps, 'style'> & {
  style?: StyleProp<ViewStyle>
  hostName?: string
}

function PopoverContent({
  style,
  hostName,
  align = 'center',
  sideOffset = CONTENT_SIDE_OFFSET,
  ...props
}: PopoverContentProps): ReactNode {
  const tokens = useTokens()
  const context = useMemo(
    () => ({ foreground: tokens.popoverForeground }),
    [tokens.popoverForeground],
  )

  return (
    <PopoverPrimitive.Portal hostName={hostName}>
      <PopoverPrimitive.Overlay style={StyleSheet.absoluteFill} testID="popover-overlay" />
      <PopoverContentContext.Provider value={context}>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={sideOffset}
          {...props}
          style={StyleSheet.flatten([popoverContentVariants(tokens), style])}
        />
      </PopoverContentContext.Provider>
    </PopoverPrimitive.Portal>
  )
}

export type PopoverTextProps = Omit<TextProps, 'variant'>

function PopoverText({ style, ...props }: PopoverTextProps): ReactNode {
  const context = usePopoverContentContext()
  const tokens = useTokens()
  return (
    <Text
      {...props}
      variant="body"
      style={[
        {
          color: context.foreground,
          fontFamily: tokens.fontFamily.sans,
          ...tokens.typography.sm,
        },
        style,
      ]}
    />
  )
}

export type PopoverCloseProps = Omit<PopoverPrimitive.CloseProps, 'style'> & {
  style?: StyleProp<ViewStyle>
}

function PopoverClose({ style, ...props }: PopoverCloseProps): ReactNode {
  return <PopoverPrimitive.Close {...props} style={style} />
}

/** Themed popover primitive. Internal — see UI Primitives in AGENTS.md. */
export const Popover = Object.assign(PopoverRoot, {
  Trigger: PopoverTrigger,
  Content: PopoverContent,
  Text: PopoverText,
  Close: PopoverClose,
})
