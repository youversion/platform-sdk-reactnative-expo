# Bridge-safe font tokens for DOM component props

## The problem

The Bible reader rendered **blank on iOS** (every time, on the home tab) with this error in the Metro logs:

```
Web ERROR [Error: Top OS ($$EXPO_DOM_HOST_OS) is not defined. This is a bug in the DOM Component runtime.]
```

`BibleCard` and `VerseOfTheDay` were unaffected, and the error did not reproduce on Android. The "Top OS" message is a **symptom**, not the cause.

In dev, the generated DOM HTML sets the runtime globals synchronously before loading the bundle (see [`0008`](0008-sdk-owned-recovery-for-android-injection-race.md)):

```html
<script>
  var injectedObject = JSON.parse(window.ReactNativeWebView.injectedObjectJson())
  window.$$EXPO_DOM_HOST_OS = injectedObject.EXPO_DOM_HOST_OS
  window.$$EXPO_INITIAL_PROPS = injectedObject.initialProps
</script>
```

On iOS, `@expo/dom-webview` has no synchronous `@JavascriptInterface` equivalent (that is an Android-only Web API), so `setInjectedJavaScriptObject` (`ios/DomWebView.swift`) defines `injectedObjectJson()` to return the props JSON **embedded in a JS template literal**:

```swift
window.ReactNativeWebView.injectedObjectJson = function () {
  return `\(source)`;   // source = JSON.stringify(injectedJavaScriptObject)
}
```

`JSON.stringify` correctly escapes a `"` to `\"`, but the JS template literal then **un-escapes** `\"` back to `"` when the function runs. Any prop value containing a `"` therefore arrives as malformed JSON, `JSON.parse` throws, and the two `window.$$EXPO_*` assignments never execute. The bundle's `registerDOMComponent` then sees `$$EXPO_DOM_HOST_OS` undefined and throws → blank component.

The reader's default font family is the CSS stack `"Source Serif 4", serif`, which contains literal double quotes — the **only** prop in the SDK whose serialized value contains a `"`. Confirmed on an iPhone simulator by temporarily dumping `injectedObjectJson()` inside the WebView: it returned `..."fontFamily":""Source Serif 4", serif"...` (unescaped inner quotes). Android is unaffected because its bridge returns the raw string from a real `@JavascriptInterface` (`RNCWebViewBridge.injectedObjectJson()`), with no template literal in the path. Regressed in SDK 56, which made `@expo/dom-webview` the default backing WebView (the previous default, `react-native-webview`, escapes the injected object safely).

## The decision

Cross the native ↔ DOM bridge with **quote-free font tokens** instead of the canonical CSS stacks, and resolve back to the canonical string inside the DOM component.

- `lib/reader-fonts.ts` defines `FONT_FAMILY_TOKEN` (`'inter'`, `'source-serif'`) plus `encodeFontFamilyForDom` / `decodeFontFamilyFromDom`.
- Native wrappers encode at the two crossings that carry the font: `native/bible-reader.tsx` → `dom/bible-reader.tsx` and `native/bible-reader-settings-sheet.tsx` → `dom/bible-reader-settings.tsx`.
- Each DOM component decodes on receipt before handing the value to the Web SDK, so the value it sees is the exact `"Source Serif 4", serif` constant — preserving the byte-for-byte parity `BibleThemeSettingsContent` needs to highlight the active font (see the note in `reader-fonts.ts`).
- Unknown values (a consumer-supplied custom stack) pass through unchanged; encoding runs on both platforms for a single code path.

Only the initial-props injection (native → DOM) is corrupted. The reverse direction (DOM → native callbacks such as `onFontSelected`) is a plain JSON round-trip over `postMessage`, so font selections still carry — and the store still persists — the canonical string. The token lives **only** on the bridge; the store, the persisted MMKV value, and the Web SDK all stay canonical, so there is no persistence migration.

## Alternatives rejected

- **Swap the double quotes for single quotes in the constants.** Breaks the exact-string match `BibleThemeSettingsContent` uses for font-highlight parity (the Web SDK's constant is `'"Source Serif 4", serif'`, double quotes).
- **`dom={{ useExpoDOMWebView: false }}` on the affected WebViews.** `react-native-webview` escapes the injected object safely, but this reverts the SDK 56 default per-WebView and must be repeated for every WebView that ever receives a quoted prop.
- **`patch-package` the `@expo/dom-webview` iOS injection** (e.g. base64-encode the JSON). This is the upstream-correct fix and worth reporting to Expo, but it is a native change requiring a dev-client rebuild and an ongoing patch. The token approach is JS-only, self-contained in SDK source (so it ships to every consumer's WebView automatically), and removes the only quoted prop the SDK sends.

## Verification

- Layer-1 unit tests for the encode/decode round-trip and the no-`"` invariant (`lib/__tests__/reader-fonts.test.ts`).
- The settings-sheet native test asserts the **token** crosses the bridge (`native/__tests__/bible-reader-settings-sheet.test.tsx`).
- On-device (iPhone simulator, SDK 56 dev build): before the fix the reader was blank; after, it renders John 1 and the pre-warmed settings/picker DOM WebViews mount without the `$$EXPO_DOM_HOST_OS` error.
