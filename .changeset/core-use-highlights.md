---
'@youversion/platform-react-native-expo-core': minor
---

Add `useHighlights`, the public hook for reading and writing Bible highlights on native.

It paints from the MMKV cache synchronously on first render (no blank frame on a cold start), applies and removes optimistically, reconciles against the server, and reverts writes that fail. `apply(color, verses)` and `remove(color, verses)` return a typed `HighlightWriteOutcome` — `ok`, `noop`, or `error` with a `reason` of `not-signed-in` / `auth` / `invalid` / `transient`, plus `failedVerses` and `succeededVerses` so a partially-applied batch is legible. Highlights come back as per-verse `Highlight[]`, ready for a controlled reader.

Also exported: `deriveServerColors` (projects the returned highlights to a verse→color map), `HIGHLIGHT_COLORS` and `isHighlightColor` (the five company-standard swatches — both write paths reject anything else), and the `HighlightScope` / `ServerColors` / `Highlight` types.

Two additions beyond the original ticket, called out so they read as intentional: `refresh()` for pull-to-refresh (it pairs with `isRefreshing`, which is safe to hand straight to `RefreshControl`), and `isRefreshing` is named for "a GET is in flight" rather than `isLoading` — `highlights` is always safe to render, so gating a spinner on it would reintroduce the blank frame the cache exists to prevent.

The highlights API wrapper and the MMKV cache stay internal; `useHighlights` is the whole public surface.
