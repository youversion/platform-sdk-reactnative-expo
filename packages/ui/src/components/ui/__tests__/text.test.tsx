import { act, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { holdSansRegistration } from '../../../test-utils/hold-sans-registration'
import { youVersionProviderWrapper } from '../../../test-utils/youversion-provider-wrapper'
import { getTokens } from '../../../theme'
import { fontMapKey } from '../../../theme/fonts'
import { Text } from '../text'

const light = getTokens('light')
const dark = getTokens('dark')

function flattenedStyle(text: string) {
  return StyleSheet.flatten(screen.getByText(text).props.style)
}

describe('Text', () => {
  it('maps variants to semantic foreground tokens in light', () => {
    render(
      <>
        <Text>Body copy</Text>
        <Text variant="muted">Muted copy</Text>
        <Text variant="heading">Heading copy</Text>
      </>,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(flattenedStyle('Body copy')).toMatchObject({
      color: light.foreground,
      fontFamily: light.fontFamily.sans,
      ...light.typography.base,
    })
    expect(flattenedStyle('Muted copy')).toMatchObject({
      color: light.mutedForeground,
      ...light.typography.sm,
    })
    expect(flattenedStyle('Heading copy')).toMatchObject({
      color: light.foreground,
      fontFamily: fontMapKey(light.fontFamily.sans, 700, 'normal'),
      ...light.typography.lg,
    })
  })

  it('resolves colors from the dark tokens under a dark provider', () => {
    render(
      <>
        <Text>Body copy</Text>
        <Text variant="muted">Muted copy</Text>
      </>,
      { wrapper: youVersionProviderWrapper('dark') },
    )

    expect(flattenedStyle('Body copy')).toMatchObject({ color: dark.foreground })
    expect(flattenedStyle('Muted copy')).toMatchObject({ color: dark.mutedForeground })
  })

  it('lets a caller style win over the variant styles', () => {
    render(<Text style={{ color: light.primary }}>Styled copy</Text>, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(flattenedStyle('Styled copy')).toMatchObject({ color: light.primary })
  })

  it('draws the system font until the sans faces register, then swaps family', async () => {
    const { register, restore } = holdSansRegistration()

    try {
      render(<Text variant="heading">Heading copy</Text>, { wrapper: youVersionProviderWrapper() })

      expect(flattenedStyle('Heading copy')).toMatchObject({ fontWeight: '700' })
      expect(flattenedStyle('Heading copy').fontFamily).toBeUndefined()

      await act(async () => {
        register()
      })

      expect(flattenedStyle('Heading copy')).toMatchObject({
        fontFamily: fontMapKey(light.fontFamily.sans, 700, 'normal'),
      })
      expect(flattenedStyle('Heading copy').fontWeight).toBeUndefined()
    } finally {
      restore()
    }
  })
})
