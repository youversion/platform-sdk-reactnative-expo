# Inactive sheet inertness

> **Amended by [ADR 0009](0009-mount-on-open-native-sheets.md):** `NativeSheet` now defaults to mount-on-open, so most sheets have no closed resident host and need none of this treatment. This ADR applies only to `keepMounted` sheets (version picker, chapter picker), which keep a resident host to hide network-data latency.

A `keepMounted` **Native Sheet** keeps its Expo DOM content mounted inside its own closed `BottomSheet` host. This pre-warms the WebView and its network data and avoids remounting sheet content on first open.

Inactive sheets must still be inert. Before a sheet-opening user action, they must not be visible, draggable, touch-blocking, or otherwise in the user's way. A mounted closed host is acceptable only while it satisfies that product requirement.

Android 12-and-below devices can visibly expose inactive bottom-sheet chrome at the bottom of the screen even when the sheet is initialized closed. Users may see and drag the closed sheet edge before any picker, settings, or footnote interaction asks for it. Safe-area and edge-to-edge geometry may influence where the leaked sheet appears, but the domain problem is broader than bottom padding: an inactive **Native Sheet** is not inert.

The preferred fix preserves WebView pre-warming by keeping inactive **Native Sheet** hosts mounted while disabling native chrome, background, backdrop, gestures, accessibility exposure, and touch participation until the sheet becomes active. Because the confirmed failure appears near the bottom safe area on older tall Android devices, inactive hosts use safe-area bottom geometry and an offscreen container translation to keep their closed host below the visible app and system-nav surface. If a platform cannot satisfy **Inactive Sheet Inertness** with a mounted host, that platform needs a documented exception.

## iOS exception

iOS does not exhibit the closed-sheet leak that motivated this ADR — a closed `BottomSheet` at `index={-1}` is already invisible and non-interactive on iOS. Applying the inert-host treatment universally translated the entire host 1000pt offscreen, which on iOS suspends `matchContents` measurement in the pre-warmed Expo DOM WebView. Small native sheets (footnotes, theme settings) that rely on `matchContents` then snap open before content has laid out, animate to a near-zero height, and visibly grow into place once the WebView reports its real size. Larger pickers were unaffected because they wrap their DOM content in a fixed-height `View` that gives `enableDynamicSizing` a stable measure immediately.

iOS therefore opts out of the inert-host treatment: inactive hosts render with default chrome, default `backgroundComponent`, default `handleComponent`, no `bottomInset`/`detached`, and no offscreen container translation. WebView pre-warming proceeds normally, and the first `snapToIndex(0)` animates to the correct content height in a single pass. This exception is scoped via `keepMounted && Platform.OS === 'android'` in [`packages/ui/src/native/native-sheet.tsx`](../../packages/ui/src/native/native-sheet.tsx).
