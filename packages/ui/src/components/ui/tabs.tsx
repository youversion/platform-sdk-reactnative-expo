import { createContext, use, useMemo } from 'react'
import type { ReactNode } from 'react'
import * as TabsPrimitive from '@rn-primitives/tabs'
import { StyleSheet } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'

import { useTheme, useTokens } from '../../hooks'
import type { Theme } from '../../hooks'
import { withAlpha } from '../../lib/color'
import { createVariants } from '../../lib/variants'
import type { VariantProps } from '../../lib/variants'
import { sansFace } from '../../theme/fonts'
import { Text } from './text'
import type { TextProps } from './text'

const LIST_HEIGHT = 36
const LIST_PADDING = 3
// Web tab list is rounded-lg (8) and triggers rounded-md (6). Local
// because only Tabs uses these numbers.
const LIST_RADIUS = 8
const TRIGGER_RADIUS = 6
const TRIGGER_PADDING_HORIZONTAL = 8
const TRIGGER_PADDING_VERTICAL = 4
const ROOT_GAP = 8
const DISABLED_OPACITY = 0.5

const tabsListVariants = createVariants((tokens) => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    height: LIST_HEIGHT,
    padding: LIST_PADDING,
    borderRadius: LIST_RADIUS,
    backgroundColor: tokens.muted,
  },
}))

const tabsTriggerVariants = createVariants((tokens) => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: LIST_HEIGHT - LIST_PADDING * 2,
    paddingHorizontal: TRIGGER_PADDING_HORIZONTAL,
    paddingVertical: TRIGGER_PADDING_VERTICAL,
    borderRadius: TRIGGER_RADIUS,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  variants: {
    selected: {
      on: { backgroundColor: tokens.background },
      off: {},
    },
    scheme: {
      none: {},
      darkSelected: {
        borderColor: withAlpha(tokens.foreground, 0.1),
        backgroundColor: withAlpha(tokens.input, 0.3),
      },
    },
  },
  defaultVariants: { selected: 'off', scheme: 'none' },
}))

type TabsTriggerVariantProps = VariantProps<typeof tabsTriggerVariants>
type TabsSelected = NonNullable<TabsTriggerVariantProps['selected']>
type TabsScheme = NonNullable<TabsTriggerVariantProps['scheme']>

function resolveScheme(theme: Theme, selected: boolean): TabsScheme {
  if (theme === 'dark' && selected) {
    return 'darkSelected'
  }
  return 'none'
}

const styles = StyleSheet.create({
  root: { gap: ROOT_GAP },
  disabled: { opacity: DISABLED_OPACITY },
})

type TabsTriggerContextValue = {
  readonly foreground: string
}

const TabsTriggerContext = createContext<TabsTriggerContextValue | null>(null)

function useTabsTriggerContext(): TabsTriggerContextValue {
  const context = use(TabsTriggerContext)
  if (context === null) {
    throw new Error('Tabs.Text must be rendered inside <Tabs.Trigger>')
  }
  return context
}

export type TabsProps = Omit<TabsPrimitive.RootProps, 'style'> & {
  style?: StyleProp<ViewStyle>
}

function TabsRoot({ style, ...props }: TabsProps): ReactNode {
  return <TabsPrimitive.Root {...props} style={[styles.root, style]} />
}

export type TabsListProps = Omit<TabsPrimitive.ListProps, 'style'> & {
  style?: StyleProp<ViewStyle>
}

function TabsList({ style, ...props }: TabsListProps): ReactNode {
  const tokens = useTokens()
  return <TabsPrimitive.List {...props} style={[tabsListVariants(tokens), style]} />
}

export type TabsTriggerProps = Omit<TabsPrimitive.TriggerProps, 'style'> & {
  style?: StyleProp<ViewStyle>
}

function TabsTrigger({ style, disabled, value, ...props }: TabsTriggerProps): ReactNode {
  const tokens = useTokens()
  const theme = useTheme()
  const { value: selectedValue } = TabsPrimitive.useRootContext()
  const selected = selectedValue === value
  const selectedKey: TabsSelected = selected ? 'on' : 'off'
  const scheme = resolveScheme(theme, selected)
  const foreground = selected || theme !== 'dark' ? tokens.foreground : tokens.mutedForeground
  const context = useMemo(() => ({ foreground }), [foreground])

  return (
    <TabsTriggerContext.Provider value={context}>
      <TabsPrimitive.Trigger
        value={value}
        disabled={disabled}
        {...props}
        style={[
          tabsTriggerVariants(tokens, { selected: selectedKey, scheme }),
          style,
          disabled === true && styles.disabled,
        ]}
      />
    </TabsTriggerContext.Provider>
  )
}

export type TabsTextProps = Omit<TextProps, 'variant'>

function TabsText({ style, ...props }: TabsTextProps): ReactNode {
  const context = useTabsTriggerContext()
  const tokens = useTokens()
  return (
    <Text
      numberOfLines={1}
      {...props}
      variant="body"
      style={[
        {
          color: context.foreground,
          ...sansFace(tokens.fontFamily.sans, 500),
          ...tokens.typography.sm,
        },
        style,
      ]}
    />
  )
}

export type TabsContentProps = Omit<TabsPrimitive.ContentProps, 'style'> & {
  style?: StyleProp<ViewStyle>
}

function TabsContent({ style, ...props }: TabsContentProps): ReactNode {
  return <TabsPrimitive.Content {...props} style={style} />
}

/** Themed tabs primitive. Internal — see UI Primitives in AGENTS.md. */
export const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Text: TabsText,
  Content: TabsContent,
})
