import { YouVersionAuthButton } from '@youversion/platform-react-native-expo-ui'
import { StyleSheet, Text, View } from 'react-native'

/** Visual harness for the branded auth button (YPE-5833). Not linked in the tab bar. */
export default function AuthButtonPreviewScreen() {
  return (
    <View style={styles.page}>
      <View style={[styles.panel, styles.lightPanel]}>
        <Text style={[styles.caption, styles.lightCaption]}>background="light"</Text>
        <YouVersionAuthButton mode="signIn" background="light" />
      </View>
      <View style={[styles.panel, styles.darkPanel]}>
        <Text style={[styles.caption, styles.darkCaption]}>background="dark"</Text>
        <YouVersionAuthButton mode="signIn" background="dark" />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
    padding: 24,
    backgroundColor: '#e8e8e8',
  },
  panel: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
  },
  lightPanel: {
    backgroundColor: '#ffffff',
  },
  darkPanel: {
    backgroundColor: '#121212',
  },
  caption: {
    fontSize: 13,
  },
  lightCaption: {
    color: '#6b6b6b',
  },
  darkCaption: {
    color: '#9b9b9b',
  },
})
