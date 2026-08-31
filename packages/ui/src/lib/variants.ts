import { StyleSheet } from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'

import type { Tokens } from '../theme'

type StyleValue = ViewStyle | TextStyle

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

type RegisteredSheet = {
  readonly [key: string]: StyleValue | undefined
}

type CachedSheet = {
  readonly sheet: RegisteredSheet
  readonly groups: readonly string[]
  readonly defaults: SelectionRecord | undefined
}

function sheetKey(group: string, value: string): string {
  // JSON escaping keeps the two halves unambiguous, so distinct pairs never share a key.
  return JSON.stringify([group, value])
}

function registerSheet(config: VariantFactoryConfig<VariantGroupMap>): RegisteredSheet {
  const pieces: { [key: string]: StyleValue } = {}
  if (config.base !== undefined) {
    pieces.base = config.base
  }
  const { variants } = config
  if (variants !== undefined) {
    for (const group of Object.keys(variants)) {
      const values = variants[group]
      if (values === undefined) {
        continue
      }
      for (const value of Object.keys(values)) {
        const piece = values[value]
        if (piece === undefined) {
          continue
        }
        pieces[sheetKey(group, value)] = piece
      }
    }
  }
  return StyleSheet.create(pieces)
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
 * Takes a factory that turns tokens into `base`, `variants`, and
 * `defaultVariants`. Returns a resolver that takes tokens plus variant props and
 * gives back a style array. Groups apply in the order the factory declares them,
 * so a later group wins a style key an earlier group also set.
 *
 * The resolver holds one built sheet per tokens object, so the factory runs once
 * per scheme and every call hands back the same style objects.
 */
export function createVariants<Groups extends VariantGroupMap>(
  factory: (tokens: Tokens) => VariantFactoryConfig<Groups>,
): VariantResolver<Groups> {
  const cache = new WeakMap<Tokens, CachedSheet>()

  return function resolveVariants(tokens: Tokens, props?: VariantSelection<Groups>): StyleValue[] {
    let cached = cache.get(tokens)
    if (cached === undefined) {
      const config = factory(tokens)
      const { variants } = config
      cached = {
        sheet: registerSheet(config),
        groups: variants === undefined ? [] : Object.keys(variants),
        defaults: asSelectionRecord(config.defaultVariants),
      }
      cache.set(tokens, cached)
    }

    const styles: StyleValue[] = []
    const { sheet } = cached
    if (sheet.base !== undefined) {
      styles.push(sheet.base)
    }

    const selection = asSelectionRecord(props)
    for (const group of cached.groups) {
      const value = selection?.[group] ?? cached.defaults?.[group]
      if (value === undefined) {
        continue
      }
      const piece = sheet[sheetKey(group, value)]
      if (piece !== undefined) {
        styles.push(piece)
      }
    }

    return styles
  }
}
