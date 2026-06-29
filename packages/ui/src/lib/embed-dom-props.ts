import type { DOMProps } from 'expo/dom'

/**
 * Container defaults for content-sized embeds (ADR 0007).
 *
 * Both backing WebViews hardcode `flex: 1` on the container: `react-native-webview`
 * on its outer container `View`, and `@expo/dom-webview` via `webviewStyles.container`
 * (`{ flex: 1 }`) applied to both the container `View` and the native view. Yoga
 * resolves an `auto` flex-basis to 0 whenever `flex > 0` — which makes Yoga discard
 * the explicit height that `matchContents` reports. Only overriding the `flex` key
 * itself lets the measured height win. `width: '100%'` keeps the DOM viewport width
 * determinate (and overrides the measured width), so embeds fill whatever wrapper the
 * consumer lays out.
 */
const EMBED_CONTAINER_STYLE = { flex: 0, width: '100%' } as const

/**
 * Scroll chrome defaults for `matchContents` embeds that should not scroll.
 * `showsVerticalScrollIndicator` / `showsHorizontalScrollIndicator` are required
 * on Android `@expo/dom-webview`, which ignores `scrollEnabled` and defaults
 * native scrollbars to visible.
 */
const MATCH_CONTENTS_SCROLL_CHROME = {
  scrollEnabled: false,
  bounces: false,
  overScrollMode: 'never',
  showsVerticalScrollIndicator: false,
  showsHorizontalScrollIndicator: false,
} as const

/**
 * Applies the embed sizing contract to a consumer-provided `dom` prop:
 * `matchContents` on by default, the container kept out of flex sizing so
 * the measured content height applies, and scrolling disabled. Consumer
 * values win — passing `matchContents: false` restores plain flex sizing
 * with no container or scroll defaults, and a consumer `containerStyle` is
 * merged after ours.
 */
export function withEmbedDomDefaults(dom?: DOMProps): DOMProps {
  const matchContents = dom?.matchContents ?? true
  if (!matchContents) {
    return { ...dom, matchContents }
  }
  return {
    ...MATCH_CONTENTS_SCROLL_CHROME,
    ...dom,
    matchContents,
    containerStyle: dom?.containerStyle
      ? [EMBED_CONTAINER_STYLE, dom.containerStyle]
      : EMBED_CONTAINER_STYLE,
  }
}

/**
 * Sheet-hosted `matchContents` embeds (footnotes, reader settings). Applies the
 * same scroll-chrome defaults as screen embeds but leaves container sizing to
 * the NativeSheet / bottom-sheet host (ADR 0007).
 */
export function withSheetDomDefaults(dom?: DOMProps): DOMProps {
  return {
    ...MATCH_CONTENTS_SCROLL_CHROME,
    ...dom,
    matchContents: dom?.matchContents ?? true,
  }
}
