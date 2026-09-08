import { View } from 'react-native'

/** Intentionally raw hex in __tests__ — must be excluded from no-raw-color scope. */
export function ExcludedTestDirFixture() {
  return <View style={{ backgroundColor: '#ff0000' }} />
}
