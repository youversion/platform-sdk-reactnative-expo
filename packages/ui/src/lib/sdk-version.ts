// Single source of truth for the SDK version reported in the `x-yvp-sdk`
// header. In source it stays `'Dev'`, so any build that runs from source (local
// dev, the example app, YouVersion-internal usage) is identifiable as
// non-published traffic in the data lake. On publish, the compiled copy of this
// file in `build/` is stamped with the real package version by
// `scripts/stamp-sdk-version.cjs` (wired into `prepublishOnly`, after
// `expo-module build`); source is never stamped, so dev keeps reporting `'Dev'`.
// See docs/adr/0012-sdk-version-stamp-on-publish.md.

// STAMP anchor: the publish stamp replaces the `'Dev'` value on the next line.
// Keep it as a lone single-quoted `'Dev'`; the stamp matches the exact
// assignment text and fails the publish if it is missing or duplicated. The
// `: string` annotation is load-bearing: without it tsc infers the literal type
// `'Dev'`, which the emitted `.d.ts` would then assert for stamped builds too.
export const SDK_VERSION: string = 'Dev'

const SDK_HEADER_NAME = 'x-yvp-sdk'

export function getSdkHeaders(): Record<string, string> {
  return { [SDK_HEADER_NAME]: `ReactNativeSDK=${SDK_VERSION}` }
}
