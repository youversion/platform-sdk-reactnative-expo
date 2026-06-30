import { View } from 'react-native'

/** Outside packages/ui/src/native — production ESLint scope must not flag this file. */
export function OutsideNativeScopeFixture() {
  return <View accessibilityLabel="Outside native scope" headerTitle="Not localized" />
}
