# DOM-owned language panel visibility in version picker

> **Superseded for the current picker.** **Version Picker Sheet** renders the **Native Bible Version Picker**. Language-panel visibility is React state in `use-version-picker.ts`. `dom/bible-version-picker-content.tsx` is deleted. The decision below records why the DOM shell kept that state.

The version ↔ language cross-fade inside **Version Picker Sheet** must stay in the Expo DOM component (`useState` in `bible-version-picker-content.tsx`), not on the React Native sheet. We initially lifted `showLanguagePicker` to native and toggled it via a **Native Action** round-trip; the first open flashed with no CSS transition because the WebView applied visible classes one frame late. Subsequent toggles animated because the element had already been painted both ways.

Native still owns sheet open/close, committed `versionId` via `onSelect`, and **Sheet Reset Key** for remounting the picker tree on each open. Only in-sheet panel visibility is **DOM-Owned Sheet UI State**. The language trigger must call `event.preventDefault()` when the DOM wrapper handles `onClick`, or the Web SDK's default `setIsLanguagesOpen` runs in parallel without driving the shell layout.
