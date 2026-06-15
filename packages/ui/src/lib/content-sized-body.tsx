/**
 * Keeps `html`, `body`, and `#root` content-sized so `dom={{ matchContents: true }}`
 * can measure the content height rather than a frame height.
 *
 * The SDK 56 DOM template (`expo-dom-component-style`) sets only
 * `html, body { -webkit-overflow-scrolling: touch }` and `#root { display: flex; flex: 1 }`
 * — it no longer pins `height: 100%` the way earlier templates did, so content sizing is
 * already the default. This override is therefore a thin defensive belt against a template
 * regression: rendered inside `#root`, it comes after the template style in document order
 * and wins the cascade at equal specificity, pinning `height: auto` explicitly.
 */
const CONTENT_SIZED_BODY_CSS = `html, body, #root { height: auto; }`

export function ContentSizedBody() {
  return <style>{CONTENT_SIZED_BODY_CSS}</style>
}
