import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { youVersionProviderWrapper } from '../../../test-utils/youversion-provider-wrapper'
import { getTokens } from '../../../theme'
import { fontMapKey } from '../../../theme/fonts'
import { Card } from '../card'
import { Text } from '../text'

const light = getTokens('light')
const dark = getTokens('dark')

function viewStyle(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style)
}

function textStyle(text: string) {
  return StyleSheet.flatten(screen.getByText(text).props.style)
}

// Only the layer Card.Title itself contributes. `Text` renders `[variants, style]`
// and the title passes its context color as that `style`, so flattening the whole
// array would pass on `Text`'s own `foreground` — the same hex as `cardForeground`
// in both schemes, which would leave the wiring untested.
function titleOwnStyle(text: string) {
  return StyleSheet.flatten(screen.getByText(text).props.style[1])
}

function renderFullCard(theme: 'light' | 'dark') {
  render(
    <Card testID="card">
      <Card.Header testID="header">
        <Card.Title>Title</Card.Title>
        <Text variant="muted">Description</Text>
      </Card.Header>
      <Card.Content testID="content">
        <Text>Body</Text>
      </Card.Content>
      <Card.Footer testID="footer">
        <Text>Footer</Text>
      </Card.Footer>
    </Card>,
    { wrapper: youVersionProviderWrapper(theme) },
  )
}

describe('Card', () => {
  it('paints the surface from the light card, border, and surface radius tokens', () => {
    renderFullCard('light')

    expect(viewStyle('card')).toMatchObject({
      backgroundColor: light.card,
      borderWidth: 1,
      borderColor: light.border,
      borderRadius: light.radius.surface,
      paddingVertical: 24,
      gap: 24,
    })
    expect(viewStyle('card').borderRadius).toBe(16)
  })

  it('resolves the surface and title from the dark tokens under a dark provider', () => {
    renderFullCard('dark')

    expect(viewStyle('card')).toMatchObject({
      backgroundColor: dark.card,
      borderColor: dark.border,
    })
    expect(titleOwnStyle('Title')).toMatchObject({ color: dark.cardForeground })
  })

  it('publishes cardForeground to Card.Title and sets the heading face and role', () => {
    renderFullCard('light')

    expect(titleOwnStyle('Title')).toMatchObject({ color: light.cardForeground })
    expect(textStyle('Title')).toMatchObject({
      fontFamily: fontMapKey(light.fontFamily.sans, 700, 'normal'),
      ...light.typography.lg,
    })
    expect(screen.getByRole('header', { name: 'Title' })).toBeTruthy()
  })

  it('lays the slots out on the shadcn ramp', () => {
    renderFullCard('light')

    expect(viewStyle('header')).toMatchObject({ paddingHorizontal: 24, gap: 6 })
    expect(viewStyle('content')).toMatchObject({ paddingHorizontal: 24 })
    expect(viewStyle('footer')).toMatchObject({
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
    })
  })

  it('throws when a slot renders outside a Card root', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = youVersionProviderWrapper()

    expect(() => render(<Card.Header />, { wrapper })).toThrow(/inside <Card>/)
    expect(() => render(<Card.Title>Orphan</Card.Title>, { wrapper })).toThrow(/inside <Card>/)
    expect(() => render(<Card.Content />, { wrapper })).toThrow(/inside <Card>/)
    expect(() => render(<Card.Footer />, { wrapper })).toThrow(/inside <Card>/)

    consoleError.mockRestore()
  })

  it('lets a caller style win on the root and on a slot', () => {
    render(
      <Card testID="card" style={{ backgroundColor: light.muted }}>
        <Card.Content testID="bleed" style={{ paddingHorizontal: 0 }}>
          <Text>Full bleed</Text>
        </Card.Content>
      </Card>,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(viewStyle('card')).toMatchObject({
      backgroundColor: light.muted,
      borderColor: light.border,
    })
    expect(viewStyle('bleed')).toMatchObject({ paddingHorizontal: 0 })
  })

  it('does not let a caller restyle the title through a Text variant', () => {
    // @ts-expect-error — `variant` is omitted from CardTitleProps; the root owns
    // the color and the title pins `heading` after the spread, so the forwarded
    // value is dropped at runtime, not merely overwritten.
    const title = <Card.Title variant="muted">Pinned</Card.Title>

    render(<Card>{title}</Card>, { wrapper: youVersionProviderWrapper() })

    expect(titleOwnStyle('Pinned')).toMatchObject({ color: light.cardForeground })
    expect(textStyle('Pinned')).toMatchObject({
      fontFamily: fontMapKey(light.fontFamily.sans, 700, 'normal'),
      ...light.typography.lg,
    })
  })

  it('forwards view props to the underlying surface', () => {
    render(<Card testID="card" accessibilityLabel="Verse card" />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(screen.getByLabelText('Verse card')).toBe(screen.getByTestId('card'))
  })
})
