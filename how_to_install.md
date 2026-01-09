# 📱 วิธีสร้างไฟล์ติดตั้ง APK สำหรับแอพ SHIP2CU Scanner

## 🎯 สิ่งที่คุณจะได้
หลังจากทำตามขั้นตอนนี้แล้ว คุณจะได้ไฟล์ `.apk` ที่สามารถติดตั้งในมือถือ Android ได้เลย โดยไม่ต้องใช้ Expo Go อีกต่อไป

---

## 📋 สิ่งที่ต้องเตรียม

### 1. บัญชี Expo (ฟรี)
- ไปที่ https://expo.dev
- กดปุ่ม "Sign up" สร้างบัญชีใหม่
- หรือ "Log in" ถ้ามีบัญชีแล้ว

### 2. ติดตั้ง EAS CLI
เปิด Command Prompt (cmd) หรือ PowerShell แล้วพิมพ์:
```bash
npm install -g eas-cli
```

---

## 🚀 ขั้นตอนการสร้าง APK

### ขั้นตอนที่ 1: เข้าสู่ระบบ Expo
```bash
eas login
```
- พิมพ์ email และ password ของบัญชี Expo
- ถ้าเข้าสู่ระบบสำเร็จจะขึ้น "Logged in"

### ขั้นตอนที่ 2: ตั้งค่าโปรเจค
```bash
eas build:configure
```
- เลือก "Android" เมื่อถาม platform
- เลือก "Yes" เมื่อถามว่าจะสร้าง eas.json หรือไม่

### ขั้นตอนที่ 3: สร้าง APK
```bash
eas build --platform android --profile preview
```

**สิ่งที่จะเกิดขึ้น:**
1. ระบบจะถามว่าจะสร้าง Android Keystore ใหม่หรือไม่ → เลือก **"Yes"**
2. ระบบจะอัพโหลดโค้ดไปยัง Expo servers
3. รอประมาณ 5-15 นาที (ขึ้นอยู่กับความเร็วอินเทอร์เน็ต)
4. เมื่อเสร็จแล้วจะได้ลิงก์ดาวน์โหลดไฟล์ APK

### ขั้นตอนที่ 4: ดาวน์โหลด APK
- คลิกลิงก์ที่ได้จากขั้นตอนที่ 3
- หรือไปที่ https://expo.dev/accounts/[username]/projects/[project-name]/builds
- กดปุ่ม "Download" เพื่อดาวน์โหลดไฟล์ APK

---

## 📱 วิธีติดตั้งในมือถือ Android

### ขั้นตอนที่ 1: เปิดการติดตั้งจากแหล่งที่ไม่รู้จัก
1. เข้า **Settings** (การตั้งค่า)
2. เข้า **Security** (ความปลอดภัย) หรือ **Privacy** (ความเป็นส่วนตัว)
3. เปิด **"Install unknown apps"** หรือ **"Unknown sources"**
4. เลือกแอพที่จะใช้ติดตั้ง (เช่น Chrome, File Manager)

### ขั้นตอนที่ 2: ติดตั้งแอพ
1. ส่งไฟล์ APK ไปยังมือถือ (ผ่าน Line, Email, หรือ USB)
2. เปิดไฟล์ APK ในมือถือ
3. กดปุ่ม **"Install"** (ติดตั้ง)
4. รอจนติดตั้งเสร็จ
5. กดปุ่ม **"Open"** (เปิด) เพื่อใช้งานแอพ

---

## 🔧 การตั้งค่าเพิ่มเติม

### สำหรับ Production (ใช้งานจริง)
ถ้าต้องการสร้าง APK สำหรับใช้งานจริง ให้ใช้คำสั่ง:
```bash
eas build --platform android --profile production
```

### เปลี่ยนชื่อแอพและไอคอน
แก้ไขไฟล์ `app.json`:
```json
{
  "expo": {
    "name": "SHIP2CU Scanner",
    "slug": "ship2cu-scanner",
    "icon": "./assets/icon/ship2cu_app.png",
    "android": {
      "package": "com.yourcompany.ship2cuscanner",
      "versionCode": 1
    }
  }
}
```

### อัพเดทเวอร์ชัน
ก่อนสร้าง APK ใหม่ ให้เพิ่มเลข version ในไฟล์ `app.json`:
```json
{
  "expo": {
    "version": "1.0.1",
    "android": {
      "versionCode": 2
    }
  }
}
```

---

## ❗ ปัญหาที่อาจเจอและวิธีแก้

### 1. "eas command not found"
**แก้ไข:** ติดตั้ง EAS CLI ใหม่
```bash
npm install -g eas-cli
```

### 2. "Not logged in"
**แก้ไข:** เข้าสู่ระบบใหม่
```bash
eas login
```

### 3. "Build failed"
**แก้ไข:** ตรวจสอบ error message และแก้ไขโค้ดตาม error ที่แจ้ง

### 4. APK ใหญ่เกินไป
**แก้ไข:** ใช้ profile production แทน preview
```bash
eas build --platform android --profile production
```

---

## 📞 ติดต่อขอความช่วยเหลือ

ถ้ามีปัญหาหรือข้อสงสัย สามารถ:
1. ดู log ใน terminal เพื่อหา error message
2. ตรวจสอบ build status ที่ https://expo.dev
3. อ่าน documentation ที่ https://docs.expo.dev/build/setup/

---

## 🎉 เสร็จแล้ว!

เมื่อทำตามขั้นตอนเสร็จแล้ว คุณจะได้:
- ✅ ไฟล์ APK ที่พร้อมติดตั้ง
- ✅ แอพที่ทำงานได้โดยไม่ต้องใช้ Expo Go
- ✅ สามารถแจกจ่ายให้คนอื่นใช้งานได้

**หมายเหตุ:** การสร้าง APK ครั้งแรกอาจใช้เวลานาน แต่ครั้งต่อไปจะเร็วขึ้น

---

## 🔄 การอัพเดทแอพ (Build ใหม่หลังแก้ไขโค้ด)

เมื่อคุณแก้ไขโค้ดแอพแล้วต้องการสร้าง APK ใหม่ ให้ทำตามขั้นตอนนี้:

### ขั้นตอนที่ 1: อัพเดทเวอร์ชัน (สำคัญมาก!)
แก้ไขไฟล์ `app.json` เพิ่มเลขเวอร์ชัน:
```json
{
  "expo": {
    "version": "1.0.1",  // เพิ่มจาก 1.0.0 เป็น 1.0.1
    "android": {
      "versionCode": 2   // เพิ่มจาก 1 เป็น 2
    }
  }
}
```

**หมายเหตุ:** ต้องเพิ่มเลข version และ versionCode ทุกครั้งที่ build ใหม่

### ขั้นตอนที่ 2: ตรวจสอบการเปลี่ยนแปลง
```bash
# ตรวจสอบว่าแอพยังทำงานได้ปกติ
expo start
```
- กด `a` เพื่อเปิดใน Android emulator
- ทดสอบฟีเจอร์ที่แก้ไข
- ถ้าทำงานได้ปกติ ให้หยุด server (Ctrl+C)

### ขั้นตอนที่ 3: สร้าง APK ใหม่
```bash
# สร้าง APK สำหรับทดสอบ
eas build --platform android --profile preview

# หรือสร้าง APK สำหรับใช้งานจริง
eas build --platform android --profile production
```

### ขั้นตอนที่ 4: รอและดาวน์โหลด
1. รอประมาณ 5-15 นาที
2. เมื่อเสร็จจะได้ลิงก์ดาวน์โหลดใหม่
3. ดาวน์โหลด APK ใหม่
4. ติดตั้งทับของเก่า (หรือถอนของเก่าก่อน)

---

## 🚀 คำสั่งย่อสำหรับการอัพเดท

สำหรับคนที่คุ้นเคยแล้ว สามารถใช้คำสั่งย่อนี้:

```bash
# 1. อัพเดทเวอร์ชันใน app.json (ทำด้วยมือ)
# 2. Build ใหม่
eas build --platform android --profile preview
```

---

## ⚠️ ข้อควรระวัง

### 1. ต้องเพิ่มเวอร์ชันทุกครั้ง
- ถ้าไม่เพิ่มเวอร์ชัน การติดตั้งอาจล้มเหลว
- Android จะปฏิเสธการติดตั้งถ้าเวอร์ชันเท่าเดิม

### 2. การติดตั้งทับของเก่า
- ถ้า signature ตรงกัน จะติดตั้งทับได้
- ถ้า signature ไม่ตรง ต้องถอนแอพเก่าก่อน

### 3. การทดสอบก่อน Build
- ควรทดสอบด้วย `expo start` ก่อนเสมอ
- แก้ bug ให้หมดก่อน build เพื่อประหยัดเวลา

---

## 📋 ตัวอย่างการอัพเดทเวอร์ชัน

### Build ครั้งที่ 1:
```json
"version": "1.0.0",
"versionCode": 1
```

### Build ครั้งที่ 2:
```json
"version": "1.0.1", 
"versionCode": 2
```

### Build ครั้งที่ 3:
```json
"version": "1.0.2",
"versionCode": 3
```

### การอัพเดทใหญ่:
```json
"version": "1.1.0",
"versionCode": 4
```

---

## 🔧 แก้ปัญหาการอัพเดท

### ปัญหา: "INSTALL_FAILED_UPDATE_INCOMPATIBLE"
**สาเหตุ:** Signature ไม่ตรงกัน
**วิธีแก้:**
1. ถอนแอพเก่าออกจากมือถือ
2. ติดตั้งแอพใหม่

### ปัญหา: "Version code must be greater"
**สาเหตุ:** ลืมเพิ่ม versionCode
**วิธีแก้:**
1. เพิ่มเลข versionCode ในไฟล์ app.json
2. Build ใหม่

### ปัญหา: Build ล้มเหลว
**วิธีแก้:**
1. ตรวจสอบ syntax error ในโค้ด
2. รัน `expo start` เพื่อหา error
3. แก้ไข error แล้ว build ใหม่

---

## 💡 เทคนิคประหยัดเวลา

### 1. ใช้ Script ใน package.json
เพิ่มใน `package.json`:
```json
{
  "scripts": {
    "build:preview": "eas build --platform android --profile preview",
    "build:prod": "eas build --platform android --profile production"
  }
}
```

แล้วใช้คำสั่ง:
```bash
npm run build:preview
```

### 2. ตั้งค่า Auto Version
ใช้ tools อื่นๆ เพื่อเพิ่มเวอร์ชันอัตโนมัติ (สำหรับผู้ใช้ขั้นสูง)

### 3. การทดสอบอย่างเป็นระบบ
- ทดสอบใน emulator ก่อน
- ทดสอบในมือถือจริง
- ทดสอบทุกฟีเจอร์ที่แก้ไข

---

**สรุป:** การอัพเดทแอพง่ายมาก แค่เพิ่มเวอร์ชันแล้วรัน `eas build` ใหม่!