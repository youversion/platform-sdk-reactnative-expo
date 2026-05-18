---
title: Expo DOM Native Provider And Sheet Pattern
date: 2026-05-08
category: architecture-patterns
module: platform-sdk-reactnative-expo
problem_type: architecture_pattern
component: tooling
severity: medium
applies_when:
  - Building React Native Expo wrappers around Expo DOM components
  - Keeping WebView-backed DOM content warm across native sheet open and close cycles
  - Exposing a single public provider while hiding native infrastructure
tags: [expo-dom, react-native, native-sheet, webview, provider]
---

# Expo DOM Native Provider And Sheet Pattern

## Context
The React Native Expo SDK wraps `@youversion/platform-react-ui` DOM components for native apps. Consumers should get a native-feeling API with one `YouVersionProvider`, while the implementation still has to respect Expo DOM boundaries and keep WebView content warm for footnote sheets.

The footnote flow exposed two easy traps:

- Native React context does not cross into Expo DOM WebViews.
- A WebView that is pre-warmed inside a tiny hidden wrapper can later open with blank or badly measured content.

## Guidance
Use a native provider for native concerns, then pass only serializable props into DOM components.

```tsx
<GestureHandlerRootView style={{ flex: 1 }}>
  <YouVersionProvider appKey={appKey}>
    <Stack />
  </YouVersionProvider>
</GestureHandlerRootView>
```

`YouVersionProvider` owns native context for `appKey` and resolved theme, and it wraps the internal `NativeSheetProvider`. Public components such as `BibleReader`, `BibleTextView`, `BibleCard`, and `VerseOfTheDay` read native context and pass `appKey` plus theme into their DOM wrappers.

DOM wrappers still need their own web provider because each DOM component runs in a separate WebView JavaScript context:

```tsx
<YouVersionProvider appKey={appKey} theme={theme}>
  <BibleTextView {...props} />
</YouVersionProvider>
```

For native sheets that display DOM content, portal each sheet's own `BottomSheet` to the root host. Do not share one sheet and hide inactive DOM content in a `1x1` wrapper.

```tsx
<Portal name={`native-sheet-${sheetId}`} hostName={HOST_NAME}>
  <SheetHost isActive={isActive} openKey={openKey} onClose={onClose}>
    {children}
  </SheetHost>
</Portal>
```

Repeated user actions need an event signal, not only boolean state. Footnote taps can keep `footnoteData` non-null, so `isOpen` remains `true`. Increment an `openKey` on each default footnote press and have the sheet snap open when the key changes.

```tsx
setFootnoteData(data);
setFootnoteOpenKey((key) => key + 1);
```

## Why This Matters
Expo DOM components run in isolated WebView contexts. Native context, live React nodes, and non-serializable values do not cross that boundary. Trying to make the DOM side read the native provider directly will fail conceptually even if the native tree compiles.

WebView layout is also sensitive to the native container it first mounts into. Pre-warming content is good, but pre-warming it in a hidden `1x1` wrapper gives `matchContents` the wrong layout reality. Keeping each sheet's DOM content in its own stable `BottomSheetView` preserves the warm WebView benefit without blank sheet content.

The explicit `openKey` avoids another subtle state bug: repeated taps on the same footnote can be meaningful user events even when the underlying open boolean does not change.

## When to Apply
- Wrapping web SDK components with Expo DOM for React Native consumers
- Adding native provider APIs around DOM-backed components
- Rendering DOM/WebView content inside native overlays, sheets, or portals
- Debugging blank WebView content after an otherwise successful native sheet open
- Debugging repeated tap behavior where the UI should reopen but boolean state stays unchanged

## Examples
Before: exposing native infrastructure directly.

```tsx
<NativeSheetProvider>
  <BibleTextView appKey={appKey} />
</NativeSheetProvider>
```

After: one public SDK provider and provider-based components.

```tsx
<YouVersionProvider appKey={appKey}>
  <BibleTextView reference="JHN.1.1-4" versionId={3034} />
</YouVersionProvider>
```

Before: hiding inactive WebView content in a tiny wrapper.

```tsx
<View style={{ height: 1, width: 1, position: "absolute", opacity: 0 }}>
  {children}
</View>
```

After: keep the WebView mounted inside its own sheet host and close the sheet off-screen.

```tsx
<BottomSheet index={-1} enableDynamicSizing>
  <BottomSheetView>{children}</BottomSheetView>
</BottomSheet>
```

## Related
- `docs/solutions/architecture-patterns/version-picker-shell-and-dom-ui-state-2026-05-18.md` — in-sheet UI state (e.g. language panel) must stay in the DOM WebView, not round-trip through native
- `packages/ui/src/native/youversion-provider.tsx`
- `packages/ui/src/native/native-sheet.tsx`
- `packages/ui/src/native/bible-reader.tsx`
- `packages/ui/src/native/bible-text-view.tsx`
- `packages/ui/src/dom/*`
