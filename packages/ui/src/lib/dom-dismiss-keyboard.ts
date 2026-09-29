import { useEffect, useRef } from 'react'

/**
 * Blur the focused HTML element inside a DOM WebView.
 *
 * React Native's `Keyboard.dismiss()` only blurs a focused RN `TextInput`, so
 * it cannot see an `<input>` in the WebView. No current sheet calls this hook.
 * Version and chapter picker search fields are React Native text fields and
 * dismiss with `Keyboard.dismiss()`. See ADR 0010.
 *
 * Only call this from `'use dom'` components. It relies on `document`.
 */
export function blurActiveDomElement(): void {
  const active = document.activeElement
  if (active instanceof HTMLElement) active.blur()
}

export function useDismissKeyboardOnClose(isOpen: boolean | undefined): void {
  const prevIsOpen = useRef<boolean | undefined>(undefined)
  useEffect(() => {
    const wasOpen = prevIsOpen.current
    prevIsOpen.current = isOpen
    if (wasOpen !== true || isOpen !== false) return
    blurActiveDomElement()
  }, [isOpen])
}

/**
 * Blur the focused DOM element when a native dismiss gesture starts (backdrop
 * tap, pan-down) before `isOpen` flips false at animation end.
 */
export function useDismissKeyboardOnSignal(signal: number | undefined): void {
  const prevSignal = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (signal === undefined) return
    const prev = prevSignal.current
    prevSignal.current = signal
    if (prev === undefined || signal === prev) return
    blurActiveDomElement()
  }, [signal])
}
