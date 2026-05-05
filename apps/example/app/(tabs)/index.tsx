import {
  BibleReader,
  BibleTextView,
} from "@youversion/platform-react-native-expo";
import { StyleSheet, Text, View } from "react-native";
import RequireAppKey from "../_components/require-app-key";

export default function BibleScreen() {
  return (
    <RequireAppKey>
      {(appKey) => (
        <View style={styles.container}>
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>BibleTextView</Text>
            <View style={styles.textView}>
              <BibleTextView
                appKey={appKey}
                reference="JHN.1.1-4"
                versionId={3034}
                showVerseNumbers
              />
            </View>
          </View>

          <View style={styles.preview}>
            <Text style={styles.previewLabel}>BibleReader</Text>
            <BibleReader
              appKey={appKey}
              defaultVersionId={3034}
              style={styles.reader}
            />
          </View>
        </View>
      )}
    </RequireAppKey>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    padding: 12,
  },
  preview: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewLabel: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    opacity: 0.7,
  },
  textView: {
    flex: 1,
    padding: 16,
  },
  reader: {
    flex: 1,
  },
});
