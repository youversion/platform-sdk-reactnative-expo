import { StyleSheet } from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'

import type { Tokens } from '../theme'

type StyleValue = ViewStyle & TextStyle

type VariantGroupMap = {
  readonly [group: string]: {
    readonly [value: string]: StyleValue
  }
}

type VariantSelection<Groups extends VariantGroupMap> = {
  readonly [Group in keyof Groups]?: keyof Groups[Group] & string
}

type VariantFactoryConfig<Groups extends VariantGroupMap> = {
  readonly base?: StyleValue
  readonly variants?: Groups
  readonly defaultVariants?: VariantSelection<Groups>
}

type VariantResolver<Groups extends VariantGroupMap> = (
  tokens: Tokens,
  props?: VariantSelection<Groups>,
) => StyleValue[]

/**
 * Variant props accepted by a `createVariants` resolver.
 */
export type VariantProps<Resolver> = Resolver extends (
  tokens: Tokens,
  props?: infer Props,
) => StyleValue[]
  ? NonNullable<Props>
  : never

type SelectionRecord = {
  readonly [group: string]: string | undefined
}

type GroupSheet = {
  readonly [value: string]: StyleValue | undefined
}

type CachedGroup = {
  readonly name: string
  readonly sheet: GroupSheet
}

type CachedSheet = {
  readonly base: StyleValue | undefined
  readonly groups: readonly CachedGroup[]
  readonly defaults: SelectionRecord | undefined
}

function buildGroups(variants: VariantGroupMap | undefined): readonly CachedGroup[] {
  if (variants === undefined) {
    return []
  }
  const groups: CachedGroup[] = []
  for (const name of Object.keys(variants)) {
    const values = variants[name]
    if (values !== undefined) {
      groups.push({ name, sheet: StyleSheet.create(values) })
    }
  }
  return groups
}

function asSelectionRecord(
  selection: VariantSelection<VariantGroupMap> | undefined,
): SelectionRecord | undefined {
  if (selection === undefined) {
    return undefined
  }
  // SAFETY: variant group names are the only keys the resolver reads; values are string variant ids.
  return selection as SelectionRecord
}

/**
 * Creates a resolver that turns tokens and variant props into an array of
 * styles. An absent prop uses `defaultVariants`. A later group overrides a
 * style key that an earlier group set.
 *
 * The factory runs one time for each tokens object. The style pieces are then
 * stable, but the array is new on every call.
 */
export function createVariants<Groups extends VariantGroupMap>(
  factory: (tokens: Tokens) => VariantFactoryConfig<Groups>,
): VariantResolver<Groups> {
  const cache = new WeakMap<Tokens, CachedSheet>()

  return function resolveVariants(tokens: Tokens, props?: VariantSelection<Groups>): StyleValue[] {
    let cached = cache.get(tokens)
    if (cached === undefined) {
      const config = factory(tokens)
      const { base } = config
      cached = {
        base: base === undefined ? undefined : StyleSheet.create({ base }).base,
        groups: buildGroups(config.variants),
        defaults: asSelectionRecord(config.defaultVariants),
      }
      cache.set(tokens, cached)
    }

    const styles: StyleValue[] = []
    if (cached.base !== undefined) {
      styles.push(cached.base)
    }

    const selection = asSelectionRecord(props)
    for (const group of cached.groups) {
      const value = selection?.[group.name] ?? cached.defaults?.[group.name]
      if (value === undefined || !Object.hasOwn(group.sheet, value)) {
        continue
      }
      const piece = group.sheet[value]
      if (piece !== undefined) {
        styles.push(piece)
      }
    }

    return styles
  }
}
