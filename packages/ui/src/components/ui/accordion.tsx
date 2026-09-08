import { createContext, use, useMemo } from 'react'
import type { ReactNode } from 'react'
import * as AccordionPrimitive from '@rn-primitives/accordion'
import { StyleSheet, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import Svg, { Path, type SvgProps } from 'react-native-svg'

import { useTokens } from '../../hooks'
import { createVariants } from '../../lib/variants'
import { fontMapKey } from '../../theme/fonts'
import { Text } from './text'
import type { TextProps } from './text'

const ITEM_BORDER_WIDTH = 1
const TRIGGER_PADDING_VERTICAL = 16
const TRIGGER_GAP = 16
const CONTENT_PADDING_BOTTOM = 16
const CHEVRON_SIZE = 16
const DISABLED_OPACITY = 0.5

const accordionItemVariants = createVariants((tokens) => ({
  base: {
    borderBottomWidth: ITEM_BORDER_WIDTH,
    borderBottomColor: tokens.border,
  },
}))

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: TRIGGER_GAP,
    paddingVertical: TRIGGER_PADDING_VERTICAL,
    backgroundColor: 'transparent',
  },
  content: { paddingBottom: CONTENT_PADDING_BOTTOM, overflow: 'hidden' },
  disabled: { opacity: DISABLED_OPACITY },
  chevronCollapsed: { transform: [{ rotate: '0deg' }] },
  chevronExpanded: { transform: [{ rotate: '180deg' }] },
})

type AccordionTriggerContextValue = {
  readonly foreground: string
}

const AccordionTriggerContext = createContext<AccordionTriggerContextValue | null>(null)

function useAccordionTriggerContext(): AccordionTriggerContextValue {
  const context = use(AccordionTriggerContext)
  if (context === null) {
    throw new Error('Accordion.Text must be rendered inside <Accordion.Trigger>')
  }
  return context
}

function ChevronDownIcon({
  color,
  size = CHEVRON_SIZE,
  ...props
}: SvgProps & { size?: number }): ReactNode {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...props}
    >
      <Path
        d="M6 9l6 6 6-6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export type AccordionProps = AccordionPrimitive.RootProps

function AccordionRoot(props: AccordionProps): ReactNode {
  return <AccordionPrimitive.Root {...props} />
}

export type AccordionItemProps = Omit<AccordionPrimitive.ItemProps, 'style'> & {
  style?: StyleProp<ViewStyle>
}

function AccordionItem({ style, ...props }: AccordionItemProps): ReactNode {
  const tokens = useTokens()
  return <AccordionPrimitive.Item {...props} style={[accordionItemVariants(tokens), style]} />
}

export type AccordionTriggerProps = Omit<
  AccordionPrimitive.TriggerProps,
  'asChild' | 'style' | 'children'
> & {
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}

function AccordionTrigger({
  style,
  disabled,
  children,
  ...props
}: AccordionTriggerProps): ReactNode {
  const tokens = useTokens()
  const { isExpanded, disabled: itemDisabled } = AccordionPrimitive.useItemContext()
  const { disabled: rootDisabled } = AccordionPrimitive.useRootContext()
  const isDisabled = disabled === true || rootDisabled === true || itemDisabled === true
  const context = useMemo(() => ({ foreground: tokens.foreground }), [tokens.foreground])

  return (
    <AccordionTriggerContext.Provider value={context}>
      <AccordionPrimitive.Header>
        <AccordionPrimitive.Trigger
          disabled={disabled}
          {...props}
          style={[styles.trigger, style, isDisabled && styles.disabled]}
        >
          {children}
          <View style={isExpanded ? styles.chevronExpanded : styles.chevronCollapsed}>
            <ChevronDownIcon color={tokens.mutedForeground} />
          </View>
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
    </AccordionTriggerContext.Provider>
  )
}

export type AccordionTextProps = Omit<TextProps, 'variant'>

function AccordionText({ style, ...props }: AccordionTextProps): ReactNode {
  const context = useAccordionTriggerContext()
  const tokens = useTokens()
  return (
    <Text
      {...props}
      variant="body"
      style={[
        {
          flexShrink: 1,
          color: context.foreground,
          fontFamily: fontMapKey(tokens.fontFamily.sans, 500, 'normal'),
          ...tokens.typography.sm,
        },
        style,
      ]}
    />
  )
}

export type AccordionContentProps = Omit<AccordionPrimitive.ContentProps, 'style'> & {
  style?: StyleProp<ViewStyle>
}

function AccordionContent({ style, children, ...props }: AccordionContentProps): ReactNode {
  return (
    <AccordionPrimitive.Content {...props} style={[styles.content, style]}>
      {children}
    </AccordionPrimitive.Content>
  )
}

/** Themed accordion primitive. Internal — see UI Primitives in AGENTS.md. */
export const Accordion = Object.assign(AccordionRoot, {
  Item: AccordionItem,
  Trigger: AccordionTrigger,
  Text: AccordionText,
  Content: AccordionContent,
})
