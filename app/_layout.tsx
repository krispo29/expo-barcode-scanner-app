import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { warmUpApiConnection } from "../utils/api";

// ป้องกัน Splash Screen ปิดอัตโนมัติ
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Pre-warm HTTP/TLS connection in background to eliminate cold scan latency
    void warmUpApiConnection();

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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
