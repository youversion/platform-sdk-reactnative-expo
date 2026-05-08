import { BibleCard } from "@youversion/platform-react-native-expo";
import { StyleSheet, View } from "react-native";

export default function BibleCardScreen() {
  return (
    <View style={styles.content}>
      <BibleCard
        reference="JHN.3.16"
        versionId={3034}
        dom={{ matchContents: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    marginHorizontal: "auto",
  },
});
