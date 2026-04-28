import { View, StyleSheet } from 'react-native'
import { BibleReader } from '@youversion/platform-react-native-expo'

export default function BibleScreen() {
  return (
    <View style={styles.container}>
      <BibleReader
        appKey={process.env.EXPO_PUBLIC_YOUVERSION_APP_KEY!}
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
