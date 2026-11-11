import type { StyleProp, ViewStyle } from 'react-native'

/**
 * Subset of `expo/dom`'s `DOMProps` for the retired Expo DOM text surface.
 * Accepts what hosts already pass; native renderers ignore every field.
 */
export type DeprecatedDomProps = {
  matchContents?: boolean
  containerStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
  scrollEnabled?: boolean
  bounces?: boolean
  overScrollMode?: 'auto' | 'always' | 'never'
  showsVerticalScrollIndicator?: boolean
  showsHorizontalScrollIndicator?: boolean
}
