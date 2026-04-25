import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { router } from "expo-router";

// สร้าง Axios instance
const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  // หาก Backend ใช้ Cookie ด้วย ให้เปิด withCredentials เพื่อส่ง Cookie ไปพร้อมกับ Request
  // withCredentials: true,
  timeout: 10000,
});

// Flag เพื่อป้องกันไม่ให้แจ้งเตือนซ้ำซ้อน ถ้ายิง API พร้อมกันหลายตัวแล้วเจอ 401 ทั้งหมด
let isRedirecting = false;

// 1. Request Interceptor (ก่อนส่ง API)
api.interceptors.request.use(
  async (config) => {
    try {
      // ดึงข้อมูล Token จาก AsyncStorage (ในกรณีของ React Native จะเทียบเท่า Local Storage)
      const token = await AsyncStorage.getItem("access_token");

      // ถ้ามี Token อยู่ใน AsyncStorage ให้แนบไปที่ Header
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Error reading token from AsyncStorage:", error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// 2. Response Interceptor (หลังจากได้ Response หรือ Error กลับมา)
api.interceptors.response.use(
  (response) => {
    // ถ้า API ทำงานสำเร็จราบรื่น ให้ส่ง Response คืนไปตามปกติ
    return response;
  },
  async (error) => {
    // เก็บ Origin Request เผื่อว่าในอนาคตต้องการทำระบบ Refresh Token อัตโนมัติ (ผ่าน _retry)
    const originalRequest = error.config;

    /**
     * STATE MISMATCH HANDLING ✨
     * กรณีที่ 1: สถานะในแอป (AsyncStorage) มีข้อมูล User และ Token ครบ เลยมองว่า "ล็อกอินอยู่" (UI ขึ้นหน้าหลัก)
     * กรณีที่ 2: แต่เซสชันจริงที่ Backend (เช่น Cookie หมดอายุ หรือ Token หมดอายุไปแล้ว) จะตอบกลับมาเป็น 401 Unauthorized
     *
     * ปัญหานี้เรียกว่า State Mismatch (Frontend/Local Storage มีข้อมูล แต่ Backend ไม่มี/หมดอายุแล้ว)
     * การแก้ไขคือ intercept จับ 401 ถ้าเกิดขึ้นแปลว่าข้อมูลสองฝั่งไม่ตรงกัน
     * จึงสั่งให้ลบ AsyncStorage (ให้ฝั่ง Local Storage หมดอายุเหมือน Server) แล้วเด้งกลับไปหน้า Login
     */
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      // originalRequest._retry = true; // เปิดสวิตช์กันลูปอินฟินิตี้ หากมีการพยายามเรียกซ้ำ

      console.warn("🔒 401 Unauthorized: State Mismatch Detected!");

      // ป้องกันการทำงานซ้ำซ้อน หากมีหลาย Request ล้มเหลวพร้อมกัน
      if (!isRedirecting) {
        isRedirecting = true;

        try {
          console.log("🧹 Clearing local storage state to sync with server...");
          // ล้างข้อมูลทั้งหมดที่เป็น state ของ user ฝั่ง Local
          // เพื่อบังคับให้แอปเข้าใจตรงกับ server ว่า "ล็อกเอาท์แล้ว/หมดอายุแล้ว"
          await AsyncStorage.multiRemove([
            "access_token",
            "user_data",
            "token_expires_at",
          ]);

          // บังคับให้หน้า React Native UI เปลี่ยนไปหน้า Login ทันที
          // path หน้าล็อกอินของคุณคือ app/login.tsx
          router.replace("/login");
        } catch (storageError) {
          console.error("Failed to clear local storage:", storageError);
        } finally {
          // หน่วงเวลาเล็กน้อยก่อนปลดล็อคการ Redirect
          setTimeout(() => {
            isRedirecting = false;
          }, 2000);
        }
      }
    }

    // สำหรับ Error อื่นๆ เช่น 400, 403, 500 ก็ปล่อยให้คืน Error ไปยัง try-catch ที่ทำการเรียก API
    return Promise.reject(error);
  },
);

export default api;
