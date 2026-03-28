import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { getValidAccessToken } from "../utils/auth";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // รอให้ Root Layout mount เสร็จก่อน
      await new Promise((resolve) => setTimeout(resolve, 100));

      const token = await getValidAccessToken();
      if (token) {
        router.replace("/(tabs)/receive");
      } else {
        router.replace("/login");
      }
    } catch (error) {
      console.error("Check auth error:", error);
      // ถ้าเกิด error ให้ไปหน้า login
      router.replace("/login");
    }
  };

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
