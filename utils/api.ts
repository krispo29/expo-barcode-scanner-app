import axios from "axios";
import { router } from "expo-router";
import { Alert } from "react-native";
import {
  AuthSessionExpiredError,
  clearStoredAuth,
  getValidAccessToken,
} from "./auth";
import { networkStatusManager } from "./networkStatus";

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 10000,
  headers: {
    Connection: "keep-alive",
  },
});

let isConnectionWarmed = false;

/**
 * Pre-warms the HTTP/TLS socket connection pool in the native Android engine (OkHttp).
 * Eliminates the 150-300ms DNS resolution & TLS 1.3 handshake penalty on the first scan.
 */
export async function warmUpApiConnection(): Promise<void> {
  if (isConnectionWarmed) return;
  try {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiUrl) return;
    await fetch(apiUrl, { method: "HEAD" }).catch(() => {});
    isConnectionWarmed = true;
  } catch {}
}

let isRedirecting = false;

const AUTH_WHITELIST_PATTERNS = ["/auth/sign-in"];

const isAuthWhitelistRequest = (url?: string) =>
  AUTH_WHITELIST_PATTERNS.some((pattern) => url?.includes(pattern));

const redirectToLogin = async () => {
  if (isRedirecting) {
    return;
  }

  isRedirecting = true;

  try {
    await clearStoredAuth();
    router.replace("/login");
  } catch (storageError) {
    console.error("Failed to clear local storage:", storageError);
  } finally {
    setTimeout(() => {
      isRedirecting = false;
    }, 2000);
  }
};

api.interceptors.request.use(
  async (config) => {
    try {
      if (isAuthWhitelistRequest(config.url)) {
        return config;
      }

      if (config.headers?.Authorization) {
        return config;
      }

      const token = await getValidAccessToken();
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
        return config;
      }

      await redirectToLogin();
      return Promise.reject(new AuthSessionExpiredError());
    } catch (error) {
      console.error("Error reading token from storage:", error);
      return Promise.reject(error);
    }
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => {
    networkStatusManager.setOnline(true);
    return response;
  },
  async (error) => {
    const isNetworkErr =
      !error?.response ||
      error?.code === "ECONNABORTED" ||
      error?.message?.includes("Network");

    if (isNetworkErr) {
      networkStatusManager.setOnline(false);
    } else if (error?.response?.status && error.response.status < 500) {
      // Reached server with 4xx status -> Network connection is alive
      networkStatusManager.setOnline(true);
    }

    const originalRequest = error.config;

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest?._retry &&
      !isAuthWhitelistRequest(originalRequest?.url)
    ) {
      console.warn("401 Unauthorized: Session expired.");
      Alert.alert(
        "เซสชันหมดอายุ (Session Expired)",
        "กรุณาเข้าสู่ระบบใหม่อีกครั้ง รายการที่บันทึกไว้ในเครื่องและคิวออฟไลน์ยังคงปลอดภัย",
        [
          {
            text: "เข้าสู่ระบบ",
            onPress: () => {
              void redirectToLogin();
            },
          },
        ],
        { cancelable: false },
      );
    }

    return Promise.reject(error);
  },
);

export default api;
