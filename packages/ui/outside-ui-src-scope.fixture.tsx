import { View } from 'react-native'

/** Outside packages/ui/src — production no-raw-color scope must not flag this file. */
export function OutsideUiSrcScopeFixture() {
  return <View style={{ backgroundColor: '#ff0000' }} />
}
