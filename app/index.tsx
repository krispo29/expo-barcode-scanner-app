import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // รอให้ Root Layout mount เสร็จก่อน
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // ตรวจสอบว่ามี token หรือไม่
      const token = await AsyncStorage.getItem('access_token');
      
      if (token) {
        // มี token แล้ว ไปหน้า scanner
        router.replace("/(tabs)/release");
      } else {
        // ยังไม่มี token ไปหน้า login
        router.replace("/login");
      }
    } catch (error) {
      console.error('Check auth error:', error);
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
