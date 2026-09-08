import { View } from 'react-native'

/** In ui scope — must be flagged by no-raw-color oxlint. */
export function InScopeFixture() {
  return <View style={{ backgroundColor: '#ff0000' }} />
}
