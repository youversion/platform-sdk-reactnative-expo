import { View } from 'react-native'

function dynamicHex(channel: number): string {
  return `#${channel.toString(16).padStart(2, '0')}`
}

/** Allowed patterns — must not be flagged by design-tokens/no-raw-color. */
export function NoRawColorAllowedFixture() {
  return (
    <View
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderColor: dynamicHex(255),
      }}
      accessibilityLabel="Documented example: rgb(255, 0, 0) in docs"
      accessibilityHint="oklch(0.5 0.2 30) mentioned in copy"
    />
  )
}
