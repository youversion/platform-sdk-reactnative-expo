# Mount-on-open native sheets

The original **Native Sheet** model kept every sheet's Expo DOM content mounted inside a closed `BottomSheet` host to pre-warm the WebView, on the assumption that an on-demand WebView cold start (~500ms when measured through `<Modal>` remounts) would be visible to the user. That assumption was never re-measured after the portal pattern landed, and the pre-warming forced the **Inactive Sheet Inertness** treatment (ADR 0006), placeholder footnote data, and permanently-resident WebViews per sheet.

## Measurement

We instrumented `FootnoteContent` in a release build on a Samsung Galaxy A15 (low-mid-range hardware) and measured press → content-sized layout for five fresh DOM WebView mounts with a warm Chromium engine: 184, 163, 174, 168, 155 ms (mean ~169ms). The interval covers WebView creation, `file:///android_asset` load, bundle eval, React mount, render, ResizeObserver, the `$match_contents_event` bridge hop, and the native height being applied. Visual capture confirmed fully painted content at the matched height.

The warm-engine condition is realistic: any screen using a Bible component (reader, card, text view) has already warmed Chromium before a sheet can open. A bottom-sheet open animation (~250–300ms) fully hides a ~170ms mount.

## Decision

`NativeSheet` defaults to **mount-on-open**: the portal'd host (and its WebView children) renders only from open until the close animation finishes, then unmounts entirely. A loader (`showLoader`) covers the brief window before `matchContents` reports a real height — on both platforms now, since there is no pre-warmed size.

Sheets whose open latency is dominated by **network data**, not WebView cold start, opt back into the resident-host model with `keepMounted`: the version picker (version list) and chapter picker (book/chapter data). Only these keep the ADR 0006 inert-host treatment; a mount-on-open host must never be suppressed, because it only exists while opening, open, or animating closed.

Consequences:

- Footnote and settings sheets no longer mount WebViews at page load; the `FootnoteContent` placeholder pre-warm is gone (the `EMPTY_FOOTNOTE` fallback remains only for the close-animation window after data clears).
- ADR 0006 narrows to `keepMounted` sheets (see its amendment).
- Known tradeoff: iOS small sheets previously opened directly at full measured height; they now open at the loader min-height and grow, matching Android. Accepted in exchange for retiring the inert-host wiring on the default path.
- Accepted edge: an open+close within a single React commit can leave a host rendered at `index -1` until the next open if Gorhom never fires the close `onChange`. Considered negligible.
