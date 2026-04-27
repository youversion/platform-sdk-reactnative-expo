import { View, StyleSheet } from 'react-native'
import { BibleReader } from '@youversion/platform-react-native-expo'

export default function BibleScreen() {
  return (
    <View style={styles.container}>
      <BibleReader
        appKey="E3hCj5PiDJfMZN6pCBoN2MGRnBQYXWjD2SMDbZA9XjFCCnLg"
        defaultVersionId={3034}
        style={styles.reader}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  reader: {
    flex: 1,
  },
})
