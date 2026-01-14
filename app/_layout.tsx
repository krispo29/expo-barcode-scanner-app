import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

// ป้องกัน Splash Screen ปิดอัตโนมัติ
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // ซ่อน Splash Screen เมื่อ layout mount เสร็จ
    const hideSplash = async () => {
      await SplashScreen.hideAsync();
    };
    hideSplash();
  }, []);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="scanner" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
