import { VerseOfTheDay } from "@youversion/platform-react-native-expo";
import { StyleSheet, Text, View } from "react-native";

export default function VerseOfTheDayScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.preview}>
        <Text style={styles.previewLabel}>VerseOfTheDay</Text>
        <View style={styles.content}>
          <VerseOfTheDay versionId={3034} dom={{ matchContents: true }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
  preview: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.15)",
    borderRadius: 12,
    overflow: "hidden",
  },
  previewLabel: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    opacity: 0.7,
  },
  content: {
    flex: 1,
    padding: 16,
  },
});
