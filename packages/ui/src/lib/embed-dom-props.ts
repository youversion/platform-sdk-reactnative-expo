import type { DOMProps } from 'expo/dom'

/**
 * Container defaults for content-sized embeds (ADR 0007).
 *
 * react-native-webview hardcodes `flex: 1` on the WebView's container, and
 * Yoga resolves an `auto` flex-basis to 0 whenever `flex > 0` — which makes
 * Yoga discard the explicit height that `matchContents` reports. Only
 * overriding the `flex` key itself lets the measured height win. `width:
 * '100%'` keeps the DOM viewport width determinate (and overrides the
 * measured width), so embeds fill whatever wrapper the consumer lays out.
 */
const EMBED_CONTAINER_STYLE = { flex: 0, width: '100%' } as const

/**
 * Applies the embed sizing contract to a consumer-provided `dom` prop:
 * `matchContents` on by default, and the container kept out of flex sizing so
 * the measured content height applies. Consumer values win — passing
 * `matchContents: false` restores plain flex sizing with no container
 * defaults, and a consumer `containerStyle` is merged after ours.
 */
export function withEmbedDomDefaults(dom?: DOMProps): DOMProps {
  const matchContents = dom?.matchContents ?? true
  if (!matchContents) {
    return { ...dom, matchContents }
  }
  return {
    ...dom,
    matchContents,
    containerStyle: dom?.containerStyle
      ? [EMBED_CONTAINER_STYLE, dom.containerStyle]
      : EMBED_CONTAINER_STYLE,
  }
}
