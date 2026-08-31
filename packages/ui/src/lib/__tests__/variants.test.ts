import { StyleSheet } from 'react-native'

import { getTokens } from '../../theme'
import { createVariants, type VariantProps } from '../variants'

const lightTokens = getTokens('light')
const darkTokens = getTokens('dark')

const button = createVariants((tokens) => ({
  base: { borderRadius: tokens.radius.md },
  variants: {
    variant: {
      default: { backgroundColor: tokens.primary },
      outline: { borderColor: tokens.border },
    },
    size: {
      sm: { height: 32 },
      lg: { height: 44 },
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'sm',
  },
}))

describe('createVariants', () => {
  it('applies defaultVariants when props are omitted', () => {
    const style = StyleSheet.flatten(button(lightTokens))

    expect(style).toMatchObject({
      borderRadius: lightTokens.radius.md,
      backgroundColor: lightTokens.primary,
      height: 32,
    })
  })

  it('lets explicit props override defaults', () => {
    const style = StyleSheet.flatten(
      button(lightTokens, { variant: 'outline', size: 'lg' }),
    )

    expect(style).toMatchObject({
      borderRadius: lightTokens.radius.md,
      borderColor: lightTokens.border,
      height: 44,
    })
    expect(style).not.toHaveProperty('backgroundColor')
  })

  it('composes multiple variant groups', () => {
    const style = StyleSheet.flatten(
      button(lightTokens, { variant: 'outline', size: 'sm' }),
    )

    expect(style).toMatchObject({
      borderRadius: lightTokens.radius.md,
      borderColor: lightTokens.border,
      height: 32,
    })
  })

  it('returns different cached colors when the scheme switches', () => {
    const light = StyleSheet.flatten(button(lightTokens))
    const dark = StyleSheet.flatten(button(darkTokens))

    expect(light.backgroundColor).toBe(lightTokens.primary)
    expect(dark.backgroundColor).toBe(darkTokens.primary)
    expect(light.backgroundColor).not.toBe(dark.backgroundColor)
  })

  it('runs the factory once per tokens object and reuses the style pieces', () => {
    let factoryCalls = 0
    const resolve = createVariants((tokens) => {
      factoryCalls += 1
      return { base: { backgroundColor: tokens.background } }
    })

    const first = resolve(lightTokens)
    const second = resolve(lightTokens)

    expect(factoryCalls).toBe(1)
    expect(second[0]).toBe(first[0])

    resolve(darkTokens)
    expect(factoryCalls).toBe(2)
  })

  it('lets a later variant group win on a shared style key', () => {
    const box = createVariants(() => ({
      variants: {
        tone: { flat: { height: 10 } },
        size: { tall: { height: 40 } },
      },
    }))

    const style = StyleSheet.flatten(box(lightTokens, { tone: 'flat', size: 'tall' }))

    expect(style.height).toBe(40)
  })

  it('treats an omitted variant prop as the default for that group', () => {
    const style = StyleSheet.flatten(button(lightTokens, { size: 'lg' }))

    expect(style).toMatchObject({
      backgroundColor: lightTokens.primary,
      height: 44,
    })
  })

  it('falls back to defaults when a variant prop is undefined', () => {
    const style = StyleSheet.flatten(button(lightTokens, { variant: undefined }))

    expect(style.backgroundColor).toBe(lightTokens.primary)
  })
})

describe('VariantProps', () => {
  it('accepts inferred variant keys', () => {
    const props: VariantProps<typeof button> = { variant: 'outline', size: 'lg' }

    expect(button(lightTokens, props)).toHaveLength(3)
  })

  it('rejects unknown variant values at the type level', () => {
    // @ts-expect-error — 'ghost' is not a variant value
    const style = StyleSheet.flatten(button(lightTokens, { variant: 'ghost' }))

    expect(style).toMatchObject({
      borderRadius: lightTokens.radius.md,
      height: 32,
    })
    expect(style).not.toHaveProperty('backgroundColor')
  })
})
