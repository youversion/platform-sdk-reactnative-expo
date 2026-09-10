import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { youVersionProviderWrapper } from '../../../test-utils/youversion-provider-wrapper'
import { getTokens } from '../../../theme'
import { fontMapKey } from '../../../theme/fonts'
import { Input } from '../input'

const light = getTokens('light')

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

function fieldStyle() {
  return StyleSheet.flatten(screen.getByPlaceholderText('Search').props.style)
}

function rootStyle() {
  return StyleSheet.flatten(screen.getByTestId('input-root').props.style)
}

describe('Input', () => {
  it('paints the field with input tokens and brand type', () => {
    render(
      <Input>
        <Input.Field placeholder="Search" />
      </Input>,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(fieldStyle()).toMatchObject({
      color: light.foreground,
      fontFamily: fontMapKey(light.fontFamily.sans, 400, 'normal'),
      ...light.typography.base,
    })
    expect(screen.getByPlaceholderText('Search').props.placeholderTextColor).toBe(
      light.mutedForeground,
    )
  })

  it('throws when a slot renders outside an Input root', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Input.Field placeholder="Orphan" />)).toThrow(/inside <Input>/)
    expect(() =>
      render(
        <Input.Clear>
          <></>
        </Input.Clear>,
      ),
    ).toThrow(/inside <Input>/)

    consoleError.mockRestore()
  })

  it('lets a caller style win over the variant styles', () => {
    render(
      <Input testID="input-root" style={{ backgroundColor: light.card }}>
        <Input.Field placeholder="Search" />
      </Input>,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(rootStyle()).toMatchObject({ backgroundColor: light.card })
  })

  it('dims when disabled and keeps that out of reach of a caller style', () => {
    render(
      <Input testID="input-root" disabled style={{ opacity: 1 }}>
        <Input.Field placeholder="Search" />
      </Input>,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(rootStyle()).toMatchObject({ opacity: 0.5 })
    expect(screen.getByPlaceholderText('Search').props.editable).toBe(false)
  })

  it('clears through Input.Clear and fades while pressed', async () => {
    const onPress = jest.fn()
    render(
      <Input>
        <Input.Field placeholder="Search" />
        <Input.Clear accessibilityLabel="Clear search" onPress={onPress} />
      </Input>,
      { wrapper: youVersionProviderWrapper() },
    )
    const clear = screen.getByRole('button', { name: 'Clear search' })

    fireEvent(clear, 'responderGrant', touchEvent())
    expect(StyleSheet.flatten(clear.props.style)).toMatchObject({ opacity: 0.8 })

    fireEvent(clear, 'responderRelease', touchEvent())
    await waitFor(() => {
      expect(StyleSheet.flatten(clear.props.style).opacity).toBeUndefined()
    })
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('caps typed text at the field maxLength', () => {
    const onChangeText = jest.fn()
    render(
      <Input>
        <Input.Field placeholder="Search" maxLength={100} onChangeText={onChangeText} />
      </Input>,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(screen.getByPlaceholderText('Search').props.maxLength).toBe(100)
  })
})
