# Content-sized body for matchContents embeds

Expo DOM Components' `dom={{ matchContents: true }}` injects a `ResizeObserver` on `document.body` and applies the reported `{width, height}` to the WebView container. Expo's DOM HTML template, however, pins `html, body { height: 100% }` and `#root { height: 100% }`, so the body always measures the WebView's own frame — never the content. That makes `matchContents` circular: the frame height is reported back as the frame height.

This stayed invisible while embeds sat in `flex: 1` screen containers — the WebView stretched to the full screen, the body reported the full screen, and the card simply painted top-aligned inside a viewport-sized box. Any layout that stops stretching the WebView (a content-sized wrapper, `alignItems: 'center'` on the parent) collapses the frame toward zero, the body reports the collapsed size, and the embed disappears.

## Decision

Embed components that should size to their content — `BibleCard`, `VerseOfTheDay` — render a `ContentSizedBody` style override (`packages/ui/src/lib/content-sized-body.tsx`) inside their DOM wrappers: `html, body, #root { height: auto }`. Rendered inside `#root`, it follows the template's `#expo-reset` stylesheet in document order and wins the cascade at equal specificity. The body then grows with content and `matchContents` measures real content height, including async re-measures as data loads.

Sheet-hosted DOM content (footnotes, reader settings, pickers) keeps the template's full-height body; its sizing contract is owned by the **Native Sheet** host and `@gorhom/bottom-sheet` dynamic sizing, and is covered by ADR 0006.

## Consumer containerStyle contract

A second trap lives on the native side: `react-native-webview` hardcodes `flex: 1` on its container `View`, and Expo appends the matched `{width, height}` plus `dom.containerStyle` after it. In Yoga, a set `flex: 1` resolves an `auto` flex-basis to `0`, and a resolved flex-basis makes Yoga ignore the explicit `height` — so the measured height is silently discarded whenever the parent does not hand the WebView flex space. `flexBasis: 'auto'` does **not** neutralize this; only overriding the `flex` key itself does.

Embeds placed in content-sized or centered layouts must therefore pass:

```tsx
dom={{ matchContents: true, containerStyle: { flex: 0, width: '100%' } }}
```

`flex: 0` lets the matched height win; `width: '100%'` keeps the DOM viewport width determinate (and overrides the matched width, which is what an embed filling its wrapper wants). A zero-height WKWebView still loads and reports its first measurement on iOS, so no placeholder `minHeight` is required. See `apps/example/app/(tabs)/verse-of-the-day.tsx` and `bible-card.tsx` for the reference layout (centered, `maxWidth`-capped wrapper).
