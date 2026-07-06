import { useEffect, useRef } from 'react'

/**
 * Dismiss the soft keyboard a DOM picker's search input raised when its native
 * sheet closes.
 *
 * The keyboard belongs to an `<input>` inside the Expo DOM WebView. React
 * Native's `Keyboard.dismiss()` only blurs the focused RN `TextInput` (via
 * `TextInputState`), which knows nothing about a WebView's HTML input, so it is
 * a no-op here. Blurring the focused element is the WebView-native way to drop
 * the IME.
 *
 * Native passes `isOpen` across the bridge; when it flips to `false` (Cancel,
 * pan-down, backdrop, or displacement all drive the sheet's `isOpen` to false)
 * we blur whatever is focused inside the WebView. This must run from inside the
 * DOM runtime — it is a one-way native→DOM command on close, not bridged UI
 * state. See docs/adr/0010-dom-keyboard-dismissal-on-sheet-close.md.
 *
 * Only call this from `'use dom'` components; it relies on the DOM runtime's
 * `document` / `HTMLElement`.
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
