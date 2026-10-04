import { Redirect, useRootNavigationState } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { getValidAccessToken } from "../utils/auth";
import { isScannerTestMode } from "../utils/scannerTestMode";

export default function Index() {
  const rootNavigationState = useRootNavigationState();
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const checkAuthStatus = async () => {
      try {
        if (isScannerTestMode) {
          if (isMounted) setDestination("/(tabs)/receive");
          return;
        }

        const token = await getValidAccessToken();
        if (isMounted) {
          setDestination(token ? "/(tabs)/receive" : "/login");
        }
      } catch (error) {
        console.error("Check auth error:", error);
        if (isMounted) setDestination("/login");
      }
    };

    void checkAuthStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  if (destination && rootNavigationState?.key) {
    return <Redirect href={destination as any} />;
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FCD34D" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E5E7EB",
  },
});
