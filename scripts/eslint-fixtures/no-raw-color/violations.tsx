import { View } from 'react-native'

/** Intentionally raw colors — must fail design-tokens/no-raw-color in regression tests. */
export function NoRawColorViolationsFixture() {
  return (
    <View
      style={{
        backgroundColor: '#ff0000',
        borderColor: 'rgb(255, 0, 0)',
        shadowColor: 'oklch(0.5 0.2 30)',
      }}
    />
  )
}
