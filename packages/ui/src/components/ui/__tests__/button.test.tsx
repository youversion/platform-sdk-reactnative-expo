import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { withAlpha } from '../../../lib/color'
import { youVersionProviderWrapper } from '../../../test-utils/youversion-provider-wrapper'
import { getTokens } from '../../../theme'
import { fontMapKey } from '../../../theme/fonts'
import { Button } from '../button'

const light = getTokens('light')
const dark = getTokens('dark')

const VARIANTS = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const

/**
 * Pressability reads `persist()` and `currentTarget.measure()` off the responder
 * event, so the touch payload has to carry them. Mirrors RNTL's own event builder.
 */
function touchEvent() {
  return {
    persist: () => {},
    nativeEvent: {
      changedTouches: [],
      identifier: 0,
      locationX: 0,
      locationY: 0,
      pageX: 0,
      pageY: 0,
      target: 0,
      timestamp: Date.now(),
      touches: [],
    },
    currentTarget: { measure: () => {} },
  }
}

function buttonStyle(name: string) {
  return StyleSheet.flatten(screen.getByRole('button', { name }).props.style)
}

function labelStyle(text: string) {
  return StyleSheet.flatten(screen.getByText(text).props.style)
}

function renderEveryVariant(theme: 'light' | 'dark') {
  render(
    <>
      {VARIANTS.map((variant) => (
        <Button key={variant} variant={variant}>
          <Button.Text>{variant}</Button.Text>
        </Button>
      ))}
    </>,
    { wrapper: youVersionProviderWrapper(theme) },
  )
}

describe('Button', () => {
  it('maps variants to container tokens in light', () => {
    renderEveryVariant('light')

    expect(buttonStyle('default')).toMatchObject({
      backgroundColor: light.primary,
      borderRadius: light.radius.md,
    })
    expect(buttonStyle('destructive')).toMatchObject({ backgroundColor: light.destructive })
    expect(buttonStyle('outline')).toMatchObject({
      borderWidth: 1,
      borderColor: light.border,
      backgroundColor: light.background,
    })
    expect(buttonStyle('secondary')).toMatchObject({ backgroundColor: light.muted })
    expect(buttonStyle('ghost')).toMatchObject({ backgroundColor: 'transparent' })
    expect(buttonStyle('link')).toMatchObject({ backgroundColor: 'transparent' })
  })

  // The alpha fills read through `withAlpha` rather than a literal: the exact
  // string is pinned against hex in `lib/__tests__/color.test.ts`, so this pins
  // the token and opacity each variant reaches for.
  it('reaches for the dark-only alpha fills web writes under `dark:`', () => {
    renderEveryVariant('dark')

    expect(buttonStyle('default')).toMatchObject({ backgroundColor: dark.primary })
    expect(buttonStyle('destructive')).toMatchObject({
      backgroundColor: withAlpha(dark.destructive, 0.6),
    })
    expect(buttonStyle('outline')).toMatchObject({
      borderColor: dark.input,
      backgroundColor: withAlpha(dark.input, 0.3),
    })
    expect(buttonStyle('secondary')).toMatchObject({ backgroundColor: dark.muted })
    expect(buttonStyle('ghost')).toMatchObject({ backgroundColor: 'transparent' })
    expect(buttonStyle('link')).toMatchObject({ backgroundColor: 'transparent' })
  })

  it('publishes the variant foreground to Button.Text', () => {
    renderEveryVariant('light')

    expect(labelStyle('default')).toMatchObject({
      color: light.primaryForeground,
      fontFamily: fontMapKey(light.fontFamily.sans, 500, 'normal'),
      ...light.typography.sm,
    })
    expect(labelStyle('destructive')).toMatchObject({ color: light.destructiveForeground })
    expect(labelStyle('outline')).toMatchObject({ color: light.foreground })
    expect(labelStyle('secondary')).toMatchObject({ color: light.foreground })
    expect(labelStyle('ghost')).toMatchObject({ color: light.foreground })
    expect(labelStyle('link')).toMatchObject({ color: light.primary })
  })

  it('publishes the dark foreground to Button.Text', () => {
    renderEveryVariant('dark')

    expect(labelStyle('default')).toMatchObject({ color: dark.primaryForeground })
    expect(labelStyle('destructive')).toMatchObject({ color: dark.destructiveForeground })
    expect(labelStyle('outline')).toMatchObject({ color: dark.foreground })
    expect(labelStyle('secondary')).toMatchObject({ color: dark.foreground })
    expect(labelStyle('ghost')).toMatchObject({ color: dark.foreground })
    expect(labelStyle('link')).toMatchObject({ color: dark.primary })
  })

  it('maps sizes to the web control ramp', () => {
    render(
      <>
        <Button>
          <Button.Text>default</Button.Text>
        </Button>
        <Button size="sm">
          <Button.Text>sm</Button.Text>
        </Button>
        <Button size="lg">
          <Button.Text>lg</Button.Text>
        </Button>
        <Button size="icon" aria-label="icon" />
      </>,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(buttonStyle('default')).toMatchObject({ height: 36, paddingHorizontal: 16, gap: 8 })
    expect(buttonStyle('sm')).toMatchObject({ height: 32, paddingHorizontal: 12, gap: 6 })
    expect(buttonStyle('lg')).toMatchObject({ height: 40, paddingHorizontal: 24, gap: 8 })
    expect(buttonStyle('icon')).toMatchObject({ height: 36, width: 36, paddingHorizontal: 0 })
  })

  it('hands Button.Icon the root foreground and icon size, and lets props win', () => {
    const received: { color: string; size: number }[] = []
    function RecordingIcon({ color, size }: { color: string; size: number }) {
      received.push({ color, size })
      return null
    }

    render(
      <>
        <Button variant="secondary" aria-label="inherited">
          <Button.Icon as={RecordingIcon} />
        </Button>
        <Button variant="secondary" aria-label="overridden">
          <Button.Icon as={RecordingIcon} color={light.destructive} size={16} />
        </Button>
      </>,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(received[0]).toEqual({ color: light.foreground, size: 24 })
    expect(received[1]).toEqual({ color: light.destructive, size: 16 })
  })

  it('throws when a slot renders outside a Button root', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Button.Text>Orphan</Button.Text>)).toThrow(/inside <Button>/)
    expect(() => render(<Button.Icon as={() => null} />)).toThrow(/inside <Button>/)

    consoleError.mockRestore()
  })

  it('fades while pressed and restores on release', async () => {
    const onPress = jest.fn()
    render(
      <Button onPress={onPress}>
        <Button.Text>Press me</Button.Text>
      </Button>,
      { wrapper: youVersionProviderWrapper() },
    )
    const button = screen.getByRole('button', { name: 'Press me' })

    fireEvent(button, 'responderGrant', touchEvent())
    expect(buttonStyle('Press me')).toMatchObject({ opacity: 0.8 })

    fireEvent(button, 'responderRelease', touchEvent())
    await waitFor(() => {
      expect(buttonStyle('Press me').opacity).toBeUndefined()
    })
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('dims when disabled and swallows the press', () => {
    const onPress = jest.fn()
    render(
      <Button disabled onPress={onPress}>
        <Button.Text>Disabled</Button.Text>
      </Button>,
      { wrapper: youVersionProviderWrapper() },
    )
    const button = screen.getByRole('button', { name: 'Disabled' })

    expect(buttonStyle('Disabled')).toMatchObject({ opacity: 0.5 })
    expect(button.props.accessibilityState).toMatchObject({ disabled: true })

    fireEvent.press(button)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('exposes the button role and an icon-only label to assistive tech', () => {
    render(<Button size="icon" aria-label="Dismiss" />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy()
  })

  it('lets a caller style win over the variant styles', () => {
    render(
      <Button style={{ backgroundColor: light.card }}>
        <Button.Text>Styled</Button.Text>
      </Button>,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(buttonStyle('Styled')).toMatchObject({ backgroundColor: light.card })
  })

  it('keeps the state styles out of reach of a caller style', () => {
    render(
      <Button disabled style={{ opacity: 1 }}>
        <Button.Text>Pinned</Button.Text>
      </Button>,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(buttonStyle('Pinned')).toMatchObject({ opacity: 0.5 })
  })

  it('does not let a caller restyle the label through a Text variant', () => {
    // @ts-expect-error — `variant` is omitted from ButtonTextProps; the root owns
    // the label color. This asserts the omission is real, not just documented.
    const label = <Button.Text variant="heading">Labeled</Button.Text>

    render(<Button>{label}</Button>, { wrapper: youVersionProviderWrapper() })

    expect(labelStyle('Labeled')).toMatchObject({
      color: light.primaryForeground,
      fontFamily: fontMapKey(light.fontFamily.sans, 500, 'normal'),
      ...light.typography.sm,
    })
  })
})
