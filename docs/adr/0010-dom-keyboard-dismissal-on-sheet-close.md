# DOM-side keyboard dismissal on sheet close

When a picker sheet (version, chapter/book) closes, the soft keyboard raised by its search input must dismiss with it. The input lives inside an Expo DOM WebView, so we dismiss it by blurring `document.activeElement` **inside the DOM runtime**, triggered by the sheet's `isOpen` prop flipping to false — not from the native side.

## Context

The search inputs in `bible-version-picker-content.tsx` and `chapter-picker-content.tsx` are HTML `<input>`s rendered by the Web SDK inside the Expo DOM WebView. Tapping the native "Cancel" control (or pan-down / backdrop / displacement) closes the **Native Sheet**, but the keyboard stayed up (YPE-3445).

React Native's `Keyboard.dismiss()` is `TextInputState.blurTextInput(TextInputState.currentlyFocusedInput())` — it only blurs the focused RN `TextInput`. The WebView's HTML input is invisible to `TextInputState`, so `currentlyFocusedInput()` is `null` and the call is a no-op. `@gorhom/bottom-sheet`'s keyboard props (`keyboardBehavior`, `keyboardBlurBehavior`) are the same story: they manage RN `TextInput`s, not WebView inputs. **The keyboard can only be dismissed from inside the WebView**, by blurring the focused element.

## Decision

The native picker sheets forward their `isOpen` across the bridge into the DOM components. A shared hook, `useDismissKeyboardOnClose(isOpen)` (`lib/dom-dismiss-keyboard.ts`), runs inside the DOM runtime and calls `document.activeElement.blur()` whenever `isOpen` becomes false. Every dismiss path (Cancel, pan-down, backdrop, displacement) drives the sheet's `isOpen` to false, so one signal covers them all.

This is a deliberate, narrow exception to the project's "don't bridge across the native/DOM boundary" instinct (see ADR 0005): it is a **one-way native→DOM command fired on close**, not synchronized UI state, so it carries none of the first-paint cross-fade hazards that motivated keeping DOM UI state out of native. Because it fires as the sheet disappears, there is no visible flash to worry about.

## Considered alternatives

- **`Keyboard.dismiss()` from the native shell** (e.g. `BottomSheet` `onAnimate`/`onClose`). Shipped first; confirmed a no-op on device because it never sees the WebView input.
- **A native module calling `InputMethodManager` / `resignFirstResponder` on the WebView's window.** Would work but adds native code to a source-only SDK for what a one-line `blur()` solves.

## Consequences

- Any future sheet whose DOM content can raise a keyboard must forward `isOpen` and call `useDismissKeyboardOnClose`. It is not automatic at the `NativeSheet` shell level, because only the DOM runtime can reach the focused element.
- The hook must only be imported by `'use dom'` components; it relies on `document` / `HTMLElement`.
