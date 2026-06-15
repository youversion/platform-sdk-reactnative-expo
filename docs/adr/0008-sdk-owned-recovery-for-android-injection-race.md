# SDK-owned recovery for the Android release-build injection race

> **Status: Retired in the Expo SDK 56 upgrade.** The module this ADR
> documents (`dom-bridge-recovery`) was deleted. The text below is preserved
> as a historical record of the problem and why the SDK owned the fix
> temporarily.

## The original problem

Expo DOM components depend on globals (`$$EXPO_DOM_HOST_OS`, `$$EXPO_INITIAL_PROPS`) that native injects via `injectedJavaScriptBeforeContentLoaded`. On Android, `react-native-webview` delivered that script through `onPageStarted` + `evaluateJavascript`, which was not guaranteed to run before page scripts when the DOM bundle loaded from `file:///android_asset` (expo/expo#41798). Release builds loaded fast enough to lose this race; dev builds never lost it (Metro HTTP latency delayed page scripts) and iOS injected synchronously via `WKUserScript`. A lost race had two permanent consequences: expo's `dom-entry` threw before mounting the React root, and expo's `marshal` locked `IS_DOM = false` at module scope, so its bridge (`emit`, prop updates, native action proxies, the `matchContents` body observer) stayed dead even after the injection landed hundreds of milliseconds later.

## Why the SDK owned it

Patching expo in the consuming app fixed the symptom but not the product: every consumer of this SDK would have had to carry the same patch in their own Expo install. Because DOM component web bundles are compiled from SDK-shipped source inside the consumer's app build, a fix that lived in our source landed in every consumer's WebView automatically. The SDK therefore owned the recovery temporarily.

The recovery module evaluated before expo's generated DOM entry called `registerDOMComponent` (the entry required the component module as the call's argument). When it detected a lost race — `ReactNativeWebView` present but `$$EXPO_DOM_HOST_OS` missing — it defined placeholder globals, trapped the late injection, and rebuilt the bridge on the raw transport primitives that were **not** gated by `IS_DOM` (`window.ReactNativeWebView.postMessage` and the `$$dom_event` CustomEvents). This ADR's closing line was: *"retire this module entirely if expo ships an injection mechanism that cannot lose the race."*

## Why it was retired (SDK 56)

Expo SDK 56 ships **`@expo/dom-webview`** as the default backing WebView for DOM components. Unlike `react-native-webview`, it is purpose-built for the DOM bridge and does not use the `onPageStarted` + `evaluateJavascript` injection path that lost the race — so it cannot lose the race. The upstream issue (expo/expo#41798) was closed on 2026-05-14, before SDK 56 went stable.

Keeping the recovery module under `@expo/dom-webview` would have been actively harmful: its `bootstrap()` runs at module-eval time and detects a "lost race" whenever `$$EXPO_DOM_HOST_OS` is unset at the moment the module evaluates — which happens routinely under `@expo/dom-webview`'s different injection timing. It would then override expo's real injection with placeholder globals and a transport rebuild built for the old `react-native-webview` primitives. On-device testing on a Samsung A15 (Android 14) confirmed DOM WebViews did not render with the recovery module still in place under SDK 56; removing it restored them.

The module and its layer-1 drift-detection test were deleted. All eight DOM components reverted to direct `export default function` declarations with no HOC wrapper.
