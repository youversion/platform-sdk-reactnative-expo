import { useTokens } from '@youversion/platform-react-native-expo-ui'
import { Pressable, StyleSheet, Text, View } from 'react-native'

export type ContentKind = 'images' | 'videos'

type ContentKindSwitchProps = {
  kind: ContentKind
  onChange: (kind: ContentKind) => void
}

const OPTIONS: readonly { kind: ContentKind; label: string }[] = [
  { kind: 'images', label: 'Images' },
  { kind: 'videos', label: 'Videos' },
]

/**
 * One capsule track with a selected pill — same shape as the Swift SampleApp
 * ContentView switch and the Figma iOS segmented control.
 */
export function ContentKindSwitch({ kind, onChange }: ContentKindSwitchProps) {
  const tokens = useTokens()

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.track,
        {
          backgroundColor: tokens.muted,
          borderRadius: tokens.radius.full,
        },
      ]}
    >
      {OPTIONS.map((option) => {
        const selected = option.kind === kind
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option.kind}
            onPress={() => onChange(option.kind)}
            style={[
              styles.option,
              selected
                ? {
                    backgroundColor: tokens.foreground,
                    borderRadius: tokens.radius.full,
                  }
                : null,
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: selected ? tokens.background : tokens.mutedForeground,
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 3,
  },
  option: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
})
