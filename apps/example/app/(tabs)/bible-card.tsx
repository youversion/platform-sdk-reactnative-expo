import { BibleCard } from "@youversion/platform-react-native-expo";
import { StyleSheet, View } from "react-native";
import RequireAppKey from "../_components/require-app-key";

export default function BibleCardScreen() {
  return (
    <RequireAppKey>
      {(appKey) => (
        <View style={styles.content}>
          <BibleCard
            appKey={appKey}
            reference="JHN.3.16"
            versionId={3034}
            dom={{ matchContents: true }}
          />
        </View>
      )}
    </RequireAppKey>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    marginHorizontal: "auto",
  },
});
