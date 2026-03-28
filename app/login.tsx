import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { persistAuthSession } from "../utils/auth";
import api from "../utils/api";

type LoginResponse = {
  code: number;
  message?: string;
  data: {
    access_token: string;
    [key: string]: any;
  };
};

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("กรุณากรอกข้อมูล", "กรุณากรอก Email และ Password");
      return;
    }

    setLoading(true);
    try {
      // เรียก API login ของ SHIP2CU ด้วย FormData
      const formData = new FormData();
      formData.append("username", email.trim());
      formData.append("password", password.trim());

      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      const endpoint = `${apiUrl}/auth/sign-in`;

      console.log("=== Login Request ===");
      console.log("Endpoint:", endpoint);
      console.log("Username:", email.trim());

      const response = await api.post<LoginResponse>(endpoint, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("=== Login Response ===");
      console.log("Response:", response.data);

      if (response.data && response.data.code === 200) {
        const expiresAt = await persistAuthSession(response.data.data);

        console.log("Login success:", response.data.data);
        console.log("Token expires at:", new Date(expiresAt).toISOString());

        // ไปหน้า scanner
        router.replace("/(tabs)/receive");
      } else {
        Alert.alert(
          "เข้าสู่ระบบไม่สำเร็จ",
          response.data.message || "กรุณาตรวจสอบ Email และ Password",
        );
      }
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง";
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      Alert.alert("เข้าสู่ระบบไม่สำเร็จ", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="dark" />

      <View style={styles.loginCard}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require("../assets/icon/android-chrome-512x512.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* Title */}
        <Text style={styles.title}>SHIP2CU</Text>

        {/* Email Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
        </View>

        {/* Password Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            onSubmitEditing={handleLogin}
          />
        </View>

        {/* Sign In Button */}
        <TouchableOpacity
          style={[styles.signInButton, loading && styles.signInButtonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.signInButtonText}>
            {loading ? "กำลังเข้าสู่ระบบ..." : "Sign In"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loginCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 40,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: "#FCD34D",
    textAlign: "center",
    marginBottom: 32,
    letterSpacing: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1F2937",
  },
  signInButton: {
    backgroundColor: "#FCD34D",
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  signInButtonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
});
