import { View } from 'react-native'

/** Intentionally raw hex in *.test.tsx — must be excluded from no-raw-color scope. */
export function ExcludedTestFileFixture() {
  return <View style={{ backgroundColor: '#ff0000' }} />
}
