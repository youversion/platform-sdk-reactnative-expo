/**
 * Expo's DOM template pins `html, body { height: 100% }` and `#root { height: 100% }`,
 * so `document.body` always measures the WebView frame, never the content. That makes
 * `dom={{ matchContents: true }}` circular: the body-size observer reports the frame
 * height back as the frame height. Embeds that should size to their content (cards)
 * render this override so the body grows with content and matchContents can measure it.
 *
 * Rendered inside `#root`, so it comes after the template's `#expo-reset` style in
 * document order and wins the cascade at equal specificity.
 */
const CONTENT_SIZED_BODY_CSS = `html, body, #root { height: auto; }`

export function ContentSizedBody() {
  return <style>{CONTENT_SIZED_BODY_CSS}</style>
}
