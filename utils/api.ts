import axios from "axios";
import { router } from "expo-router";
import {
  AuthSessionExpiredError,
  clearStoredAuth,
  getValidAccessToken,
} from "./auth";

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 10000,
});

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
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest?._retry &&
      !isAuthWhitelistRequest(originalRequest?.url)
    ) {
      console.warn("401 Unauthorized: state mismatch detected.");
      await redirectToLogin();
    }

    return Promise.reject(error);
  },
);

export default api;
