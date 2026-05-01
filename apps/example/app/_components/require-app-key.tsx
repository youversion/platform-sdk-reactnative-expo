import { StyleSheet, Text, View } from "react-native";

export default function RequireAppKey({
  children,
}: {
  children: (appKey: string) => React.ReactNode;
}) {
  const appKey = process.env.EXPO_PUBLIC_YOUVERSION_APP_KEY;

  if (!appKey) return <MissingAppKey />;
  return <>{children(appKey)}</>;
}

function MissingAppKey() {
  return (
    <View style={[styles.container, styles.missingKeyContainer]}>
      <Text style={styles.missingKeyTitle}>Missing app key</Text>
      <Text style={styles.missingKeyBody}>
        Set EXPO_PUBLIC_YOUVERSION_APP_KEY in your environment (or an .env file)
        and restart the dev server.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
  missingKeyContainer: {
    padding: 16,
    gap: 8,
    justifyContent: "center",
  },
  missingKeyTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  missingKeyBody: {
    fontSize: 14,
    opacity: 0.85,
  },
});
