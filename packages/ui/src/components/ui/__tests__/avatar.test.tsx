import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { youVersionProviderWrapper } from '../../../test-utils/youversion-provider-wrapper'
import { getTokens } from '../../../theme'
import { Avatar } from '../avatar'

const light = getTokens('light')
const wrapper = youVersionProviderWrapper()

function viewStyle(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style)
}

describe('Avatar', () => {
  it('renders the image when a uri is set', () => {
    render(
      <Avatar testID="avatar">
        <Avatar.Image uri="https://cdn.example.com/a.png" testID="avatar-image" />
      </Avatar>,
      { wrapper },
    )

    const image = screen.getByTestId('avatar-image')
    expect(image.type).toBe('Image')
    expect(image.props.source).toEqual({ uri: 'https://cdn.example.com/a.png' })
    expect(viewStyle('avatar')).toMatchObject({
      width: 32,
      height: 32,
      borderRadius: light.radius.full,
      overflow: 'hidden',
    })
  })

  it('renders two-letter initials when there is no image', () => {
    render(
      <Avatar>
        <Avatar.Fallback name="Jane Doe" testID="avatar-fallback" />
      </Avatar>,
      { wrapper },
    )

    expect(screen.getByText('JD')).toBeTruthy()
    expect(viewStyle('avatar-fallback')).toMatchObject({
      backgroundColor: light.background,
      borderWidth: 2,
      borderColor: light.foreground,
    })
  })

  it('uses the first and last word for names with a middle name', () => {
    render(
      <Avatar>
        <Avatar.Fallback name="Cam Michael Anderson" />
      </Avatar>,
      { wrapper },
    )

    expect(screen.getByText('CA')).toBeTruthy()
  })

  it('uses one letter for a single name', () => {
    render(
      <Avatar>
        <Avatar.Fallback name="Cher" />
      </Avatar>,
      { wrapper },
    )

    expect(screen.getByText('C')).toBeTruthy()
  })

  it('paints an empty circle when the fallback has no name', () => {
    render(
      <Avatar>
        <Avatar.Fallback testID="avatar-fallback" />
      </Avatar>,
      { wrapper },
    )

    expect(screen.queryByText(/./)).toBeNull()
    expect(viewStyle('avatar-fallback')).toMatchObject({ backgroundColor: light.background })
  })

  it('throws when a slot renders outside an Avatar root', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Avatar.Image uri="https://cdn.example.com/a.png" />)).toThrow(
      /inside <Avatar>/,
    )
    expect(() => render(<Avatar.Fallback name="Jane" />)).toThrow(/inside <Avatar>/)

    consoleError.mockRestore()
  })
})
