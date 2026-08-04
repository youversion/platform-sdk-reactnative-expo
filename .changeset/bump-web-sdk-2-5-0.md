---
'@youversion/platform-react-native-expo-core': patch
'@youversion/platform-react-native-expo-ui': minor
---

Update the Web SDK dependencies to 2.5.0 — `@youversion/platform-core` (core, from 2.4.0) and `@youversion/platform-react-ui` (UI, from 2.4.0), which brings `@youversion/platform-core` and `@youversion/platform-react-hooks` 2.5.0 with it, so a single copy of each resolves across the workspace.

**The Bible reader's default serif font changes from Source Serif 4 to Untitled Serif**, YouVersion's brand serif (YPE-1350, YPE-1910). The Web SDK now loads it from the YouVersion Fonts API, so a DOM component's WebView makes **a new outbound request** to `api.youversion.com` for the stylesheet plus woff2 fetches from `cdn.youversion.com`. There is no opt-out and no new prop. If those hosts are blocked, serif text falls back to Source Serif 4 with no layout break.

Two native-side changes were required to keep the reader working across that swap:

- `reader-fonts` now mirrors the new `UNTITLED_SERIF_FONT` stack (`'"Untitled Serif", "Source Serif 4", serif'`) and carries it over the native/DOM bridge as an `untitled-serif` token. Without this, selecting the serif font in reader settings would have sent the raw quoted stack across the bridge, which corrupts `@expo/dom-webview`'s prop injection on iOS and renders the reader blank (see `docs/adr/0009-bridge-safe-font-tokens.md`). `SOURCE_SERIF_FONT` is retained, deprecated, so values persisted by earlier versions still encode to a known token.
- The reader settings store defaults to Untitled Serif and migrates a persisted Source Serif value on read. The Web SDK performs this migration itself only when `fontFamily` is uncontrolled; we always pass it controlled, so the reader would otherwise have kept the deprecated stack and matched neither font button in the picker.

Readers who had explicitly chosen Source Serif are migrated to Untitled Serif, matching the Web SDK. Any other `fontFamily` you pass or persist is left untouched.
