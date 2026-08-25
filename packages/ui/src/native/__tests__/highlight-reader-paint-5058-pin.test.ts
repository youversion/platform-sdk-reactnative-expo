/**
 * Seam 5 of YPE-5059: after Expo pins a published `@youversion/platform-react-ui`
 * that contains YPE-5058, reader paint and Words of Christ must match that
 * release (six hexes, mixSrgb fills, unmixed WOC `#94000C` / `#e4bfc2`).
 *
 * Skipped: YPE-5058 is not on npm. platform-sdk-react#359 is still open. Do not
 * git-pin that PR. Enable this once a published version contains 5058.
 */
describe('reader paint after the YPE-5058 platform-react-ui pin', () => {
  it.skip('reader paint and WOC match YPE-5058 once platform-react-ui publishes it', () => {
    throw new Error(
      'Enable after pinning a published @youversion/platform-react-ui that contains YPE-5058. Do not git-pin platform-sdk-react#359.',
    )
  })
})
