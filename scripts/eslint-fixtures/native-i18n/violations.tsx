import { TextInput, View } from 'react-native'

/** Intentionally hardcoded strings — must fail native i18n ESLint in regression tests. */
export function NativeI18nViolationsFixture() {
  return (
    <View
      accessibilityLabel="Open menu"
      accessibilityHint="Opens the navigation menu"
      headerTitle="Versions"
      title="Settings"
      label="Name"
    >
      <TextInput placeholder="Enter your name" />
    </View>
  )
}
