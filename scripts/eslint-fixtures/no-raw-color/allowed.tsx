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
    />
  )
}
