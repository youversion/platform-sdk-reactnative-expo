import { StyleSheet } from 'react-native'

import { getTokens } from '../../theme'
import { createVariants, type VariantProps } from '../variants'

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
    const style = StyleSheet.flatten(button(getTokens('light')))

    expect(style).toMatchObject({
      borderRadius: 30,
      backgroundColor: '#121212',
      height: 32,
    })
  })

  it('lets explicit props override defaults', () => {
    const style = StyleSheet.flatten(
      button(getTokens('light'), { variant: 'outline', size: 'lg' }),
    )

    expect(style).toMatchObject({
      borderRadius: 30,
      borderColor: '#dddbdb',
      height: 44,
    })
    expect(style).not.toHaveProperty('backgroundColor')
  })

  it('composes multiple variant groups', () => {
    const style = StyleSheet.flatten(
      button(getTokens('light'), { variant: 'outline', size: 'sm' }),
    )

    expect(style).toMatchObject({
      borderRadius: 30,
      borderColor: '#dddbdb',
      height: 32,
    })
  })

  it('returns different cached colors when the scheme switches', () => {
    const light = StyleSheet.flatten(button(getTokens('light')))
    const dark = StyleSheet.flatten(button(getTokens('dark')))

    expect(light.backgroundColor).toBe('#121212')
    expect(dark.backgroundColor).toBe('#f04c59')
    expect(light.backgroundColor).not.toBe(dark.backgroundColor)
  })

  it('registers StyleSheet entries once per tokens object', () => {
    const spy = jest.spyOn(StyleSheet, 'create')
    const resolve = createVariants((tokens) => ({
      base: { backgroundColor: tokens.background },
    }))

    try {
      resolve(getTokens('light'))
      resolve(getTokens('light'))
      expect(spy).toHaveBeenCalledTimes(1)

      resolve(getTokens('dark'))
      expect(spy).toHaveBeenCalledTimes(2)
    } finally {
      spy.mockRestore()
    }
  })

  it('treats an omitted variant prop as the default for that group', () => {
    const style = StyleSheet.flatten(button(getTokens('light'), { size: 'lg' }))

    expect(style).toMatchObject({
      backgroundColor: '#121212',
      height: 44,
    })
  })

  it('falls back to defaults when a variant prop is undefined', () => {
    const style = StyleSheet.flatten(button(getTokens('light'), { variant: undefined }))

    expect(style.backgroundColor).toBe('#121212')
  })
})

describe('VariantProps', () => {
  it('accepts inferred variant keys', () => {
    const props: VariantProps<typeof button> = { variant: 'outline', size: 'lg' }

    expect(button(getTokens('light'), props)).toHaveLength(3)
  })

  it('rejects unknown variant values at the type level', () => {
    // @ts-expect-error — 'ghost' is not a variant value
    const style = StyleSheet.flatten(button(getTokens('light'), { variant: 'ghost' }))

    expect(style).toMatchObject({
      borderRadius: 30,
      height: 32,
    })
    expect(style).not.toHaveProperty('backgroundColor')
  })
})
