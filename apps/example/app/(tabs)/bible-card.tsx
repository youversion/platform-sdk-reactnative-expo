import { BibleCard } from "@youversion/platform-react-native-expo";
import RequireAppKey from "../_components/require-app-key";
import { View } from "react-native";

export default function BibleCardScreen() {
  return (
    <RequireAppKey>
      {(appKey) => (
        <View>
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
