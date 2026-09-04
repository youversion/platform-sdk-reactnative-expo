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
  it('paints a borderless surface from the light card and surface radius tokens', () => {
    renderFullCard('light')

    expect(viewStyle('card')).toMatchObject({
      backgroundColor: light.card,
      borderRadius: light.radius.surface,
      paddingVertical: 24,
      gap: 24,
    })
    expect(viewStyle('card').borderRadius).toBe(16)
    expect(viewStyle('card').borderWidth).toBeUndefined()
  })

  it('resolves the surface and title from the dark tokens under a dark provider', () => {
    renderFullCard('dark')

    expect(viewStyle('card')).toMatchObject({
      backgroundColor: dark.card,
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

  it('lays the slots out on the shadcn padding, with local header and footer gaps', () => {
    renderFullCard('light')

    expect(viewStyle('header')).toMatchObject({ paddingHorizontal: 24, gap: 2 })
    expect(viewStyle('content')).toMatchObject({ paddingHorizontal: 24 })
    expect(viewStyle('footer')).toMatchObject({
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 24,
    })
  })

  it('throws when Card.Title renders outside a Card root', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = youVersionProviderWrapper()

    expect(() => render(<Card.Title>Orphan</Card.Title>, { wrapper })).toThrow(/inside <Card>/)

    consoleError.mockRestore()
  })

  // The layout slots read no context, so they degrade to plain padded Views
  // rather than crashing a tree that re-parents one out of its root.
  it('renders the layout slots outside a Card root', () => {
    const wrapper = youVersionProviderWrapper()

    render(
      <>
        <Card.Header testID="header" />
        <Card.Content testID="content" />
        <Card.Footer testID="footer" />
      </>,
      { wrapper },
    )

    expect(viewStyle('header')).toMatchObject({ paddingHorizontal: 24, gap: 2 })
    expect(viewStyle('content')).toMatchObject({ paddingHorizontal: 24 })
    expect(viewStyle('footer')).toMatchObject({ paddingHorizontal: 24 })
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
      borderRadius: light.radius.surface,
    })
    expect(viewStyle('bleed')).toMatchObject({ paddingHorizontal: 0 })
  })

  // The one non-vacuous colour assertion here. The checks above read `style[1]`
  // because `cardForeground` and `foreground` share a hex, so they pass whether
  // or not the context is wired; `destructive` shares one with neither — and
  // `primary` would not work, it is `foreground`'s hex — so this fails for real
  // if the title stops merging caller `style` after the context colour.
  it('lets a caller style win on the title', () => {
    render(
      <Card>
        <Card.Title style={{ color: light.destructive }}>Recoloured</Card.Title>
      </Card>,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(light.destructive).not.toBe(light.cardForeground)
    expect(textStyle('Recoloured')).toMatchObject({ color: light.destructive })
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
