/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react-native'

import {
  blurActiveDomElement,
  useDismissKeyboardOnClose,
  useDismissKeyboardOnSignal,
} from '../dom-dismiss-keyboard'

describe('blurActiveDomElement', () => {
  it('blurs the focused HTMLElement', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    const blurSpy = jest.spyOn(input, 'blur')

    blurActiveDomElement()

    expect(blurSpy).toHaveBeenCalledTimes(1)
    document.body.removeChild(input)
  })

  it('does nothing when activeElement is not an HTMLElement', () => {
    expect(() => blurActiveDomElement()).not.toThrow()
  })
})

describe('useDismissKeyboardOnClose', () => {
  it('blurs when isOpen transitions from true to false', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    const blurSpy = jest.spyOn(input, 'blur')

    const { rerender } = renderHook(({ isOpen }: { isOpen: boolean }) => useDismissKeyboardOnClose(isOpen), {
      initialProps: { isOpen: true },
    })

    expect(blurSpy).not.toHaveBeenCalled()

    rerender({ isOpen: false })

    expect(blurSpy).toHaveBeenCalledTimes(1)
    document.body.removeChild(input)
  })
})

describe('useDismissKeyboardOnSignal', () => {
  it('blurs when the signal increments but not on initial mount', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    const blurSpy = jest.spyOn(input, 'blur')

    const { rerender } = renderHook(
      ({ signal }: { signal: number }) => useDismissKeyboardOnSignal(signal),
      { initialProps: { signal: 0 } },
    )

    expect(blurSpy).not.toHaveBeenCalled()

    rerender({ signal: 1 })

    expect(blurSpy).toHaveBeenCalledTimes(1)
    document.body.removeChild(input)
  })
})
