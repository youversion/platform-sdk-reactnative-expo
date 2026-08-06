import * as Application from 'expo-application'

/**
 * The integrating app's display name, interpolated into the sign-in sheet's
 * `signInParagraph` ("{appName} wants to connect to your YouVersion Bible App
 * account…"). `expo-application` reads the iOS display name or the Android app
 * label, so consumers configure nothing.
 *
 * Returns `null` when the platform reports no name, which in practice is only
 * web. Callers interpolate an empty string instead of an untranslatable English
 * default.
 */
export function resolveAppName(): string | null {
  const name = Application.applicationName
  if (typeof name !== 'string') {
    return null
  }
  const trimmed = name.trim()
  return trimmed.length > 0 ? trimmed : null
}
