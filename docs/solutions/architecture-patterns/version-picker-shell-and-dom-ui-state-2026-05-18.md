---
title: Version Picker Shell And DOM-Owned UI State
date: 2026-05-18
category: architecture-patterns
module: platform-sdk-reactnative-expo
problem_type: architecture_pattern
component: bible-version-picker-sheet
severity: medium
applies_when:
  - Building or debugging the version picker sheet language panel
  - Deciding what state belongs in React Native vs inside an Expo DOM WebView
  - Cross-fade or transition inside a sheet does not run on first open
tags: [expo-dom, version-picker, native-action, webview, css-transition]
---

# Version Picker Shell And DOM-Owned UI State

## Context

**Version Picker Sheet** hosts one Expo DOM WebView with two stacked panels: Bible versions and languages. On web, **BibleVersionPicker** uses a Radix popover and `isLanguagesOpen` for the cross-fade. On mobile, `bible-version-picker-content.tsx` (**Version Picker Shell Layout**) owns the same UX outside the popover.

## What crosses the native bridge

| Concern | Owner | Mechanism |
| --- | --- | --- |
| Sheet open / close | Native | `isOpen` on **Native Sheet** |
| Committed `versionId` | Native → consumer | `onSelect` after DOM `onVersionChange` |
| Scroll / search / panel reset on reopen | Native → DOM | **Sheet Reset Key** (`resetKey` prop) |
| Version ↔ language panel visibility | DOM only | `useState` in shell — not serializable props, not **Native Actions** |
| Keyboard overlap in search fields | DOM only | `visualViewport` + `--yv-keyboard-overlap` on shell |

## Failure mode we hit

Lifting `showLanguagePicker` to React Native and toggling via `handleShowLanguagePicker` (async **Native Action**):

1. User taps language trigger in WebView.
2. Web SDK also sets `isLanguagesOpen` (unless `preventDefault()`).
3. Native updates state; prop serializes back into WebView.
4. First `false → true` on panel classes often skips the 300ms transition (flash). Later toggles animate.

Fix: keep panel visibility in the DOM; `preventDefault()` on `BibleVersionPickerLanguageTrigger` when the shell handles the click.

## Implementation pointers

- Shell: `packages/ui/src/dom/bible-version-picker-content.tsx`
- Panel classes: `packages/ui/src/lib/version-picker-panels.ts` (unit-tested)
- Native wrapper: `packages/ui/src/native/bible-version-picker-sheet.tsx` — passes `resetKey`, not language visibility
- Regression test: native sheet must not pass `showLanguagePicker` / `handleShowLanguagePicker` to DOM

## Related

- `CONTEXT.md` — **Version Picker Shell Layout**, **DOM-Owned Sheet UI State**, **Sheet Reset Key**
- `docs/adr/0005-dom-owned-language-panel-in-version-picker.md`
- `docs/solutions/architecture-patterns/expo-dom-native-provider-sheet-pattern-2026-05-08.md`
