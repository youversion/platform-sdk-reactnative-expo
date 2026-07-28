import * as Application from 'expo-application'

/**
 * The integrating app's display name, interpolated into the sign-in sheet's
 * `signIn.paragraph` ("{appName} wants to connect to your YouVersion Bible App
 * account…").
 *
 * Derived rather than configured (design Resolved Question 17): `expo-application`
 * is already a peer of `@youversion/platform-react-native-expo-core`, and the
 * app's own display name is exactly what the copy asks for — so this costs zero
 * new provider props and is correct by default. If the resolved value proves
 * unreliable on Android (which reads the app label, not iOS's display name),
 * this function is the single place an explicit `appName` provider prop replaces.
 *
 * Returns `null` rather than a hardcoded English fallback: a default here would
 * be an untranslatable user-visible string. In practice the only platform that
 * reports `null` is web, where the sign-in sheet never renders (`NativeSheet` is
 * a no-op there).
 */
export function resolveAppName(): string | null {
  const name = Application.applicationName
  if (typeof name !== 'string') {
    return null
  }
  const trimmed = name.trim()
  return trimmed.length > 0 ? trimmed : null
}
