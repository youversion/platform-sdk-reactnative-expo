// Single source of truth for the SDK version stamped into the `x-yvp-sdk`
// header. Defaults to `Dev` so non-release builds are clearly identifiable in
// the data lake; the release workflow rewrites the value below before publish.

// STAMP:SDK_VERSION — release workflow replaces the string literal on the
// next line. Do not reformat (regex matches `'Dev'` exactly).
export const SDK_VERSION = 'Dev'

const SDK_HEADER_NAME = 'x-yvp-sdk'

export function getSdkHeaders(): Record<string, string> {
  return { [SDK_HEADER_NAME]: `ReactNativeSDK=${SDK_VERSION}` }
}
