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

<<<<<<< HEAD
      // ตรวจสอบว่ามี token หรือไม่
      const token = await AsyncStorage.getItem("access_token");
      const expiresAt = await AsyncStorage.getItem("token_expires_at");

      // ตรวจสอบว่า token ยังไม่หมดอายุ
      const isTokenValid =
        token && expiresAt && Date.now() < Number.parseInt(expiresAt, 10);

      if (token && !isTokenValid) {
        // Token หมดอายุแล้ว → ล้างข้อมูลทั้งหมด
        console.log("Token expired, clearing auth data...");
        await AsyncStorage.multiRemove([
          "access_token",
          "user_data",
          "token_expires_at",
        ]);
      }

      if (isTokenValid) {
=======
      const token = await getValidAccessToken();
      if (token) {
>>>>>>> 80e9c29ff9aafd53a6597cef0f2b4f98d2cd78ba
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
