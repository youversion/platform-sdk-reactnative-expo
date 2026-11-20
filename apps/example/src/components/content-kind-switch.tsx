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

export function ContentKindSwitch({ kind, onChange }: ContentKindSwitchProps) {
  const tokens = useTokens()

  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const selected = option.kind === kind
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={option.kind}
            onPress={() => onChange(option.kind)}
            style={[
              styles.option,
              {
                backgroundColor: selected ? tokens.foreground : tokens.muted,
                borderRadius: tokens.radius.full,
              },
            ]}
          >
            <Text style={{ color: selected ? tokens.background : tokens.foreground }}>
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
})
