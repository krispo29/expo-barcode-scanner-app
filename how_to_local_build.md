# วิธี Build Local ด้วย Android Studio

คู่มือการ build แอป React Native/Expo บนเครื่อง Windows ด้วย Android Studio

## 📋 สิ่งที่ต้องเตรียม

- Windows 10/11
- อินเทอร์เน็ตสำหรับดาวน์โหลด
- พื้นที่ว่างประมาณ 10-15 GB
- RAM อย่างน้อย 8 GB (แนะนำ 16 GB)

## 🔧 ขั้นตอนที่ 1: ติดตั้ง Java JDK

### วิธีที่ 1: ใช้ Winget (แนะนำ)
```powershell
# เปิด PowerShell as Administrator
winget install Microsoft.OpenJDK.17
```

### วิธีที่ 2: ดาวน์โหลดจาก Oracle
1. ไปที่ https://www.oracle.com/java/technologies/downloads/
2. ดาวน์โหลด **JDK 17** สำหรับ Windows x64
3. ติดตั้งตามขั้นตอน

### ตรวจสอบการติดตั้ง
```powershell
java -version
```
ควรแสดงผลคล้าย:
```
openjdk version "17.0.17" 2025-10-21 LTS
OpenJDK Runtime Environment Microsoft-12574423 (build 17.0.17+10-LTS)
```

## 🤖 ขั้นตอนที่ 2: ติดตั้ง Android Studio

### ดาวน์โหลดและติดตั้ง
1. ไปที่ https://developer.android.com/studio
2. คลิก **Download Android Studio**
3. รันไฟล์ `.exe` ที่ดาวน์โหลดมา
4. ทำตาม Setup Wizard:
   - เลือก **Standard** installation
   - ยอมรับ License Agreements
   - รอให้ดาวน์โหลด SDK เสร็จ

### ติดตั้ง SDK และ Tools เพิ่มเติม
1. เปิด Android Studio
2. ไป **File > Settings** (หรือ **Android Studio > Preferences** บน Mac)
3. วิธีหา Android SDK Settings:
   - **วิธีที่ 1**: คลิก **System Settings** ในแถบซ้าย แล้วหา **Android SDK**
   - **วิธีที่ 2**: ใช้ช่องค้นหาด้านบน พิมพ์ **"Android SDK"**
   - **วิธีที่ 3**: ปิด Settings แล้วไป **Tools > SDK Manager**
4. ใน **SDK Platforms** tab ติดตั้ง:
   - ✅ **Android 14.0 (API 34)** - ล่าสุด
   - ✅ **Android 13.0 (API 33)** - สำรอง
5. ใน **SDK Tools** tab ติดตั้ง:
   - ✅ **Android SDK Build-Tools 34.0.0**
   - ✅ **Android SDK Command-line Tools (latest)**
   - ✅ **Android SDK Platform-Tools**
   - ✅ **Android Emulator**
   - ✅ **Intel x86 Emulator Accelerator (HAXM installer)**
6. คลิก **Apply** และรอให้ดาวน์โหลดเสร็จ

## 🌍 ขั้นตอนที่ 3: ตั้งค่า Environment Variables

### ตั้งค่าผ่าน System Properties
1. กด **Win + R** พิมพ์ `sysdm.cpl` แล้วกด Enter
2. คลิก **Advanced** tab
3. คลิก **Environment Variables**

### เพิ่ม JAVA_HOME
ใน **System Variables**:
1. คลิก **New**
2. **Variable name**: `JAVA_HOME`
3. **Variable value**: `C:\Program Files\Microsoft\jdk-17.0.17.10-hotspot`
   (หรือตำแหน่งที่ติดตั้ง Java)

### เพิ่ม ANDROID_HOME
ใน **System Variables**:
1. คลิก **New**
2. **Variable name**: `ANDROID_HOME`
3. **Variable value**: `C:\Users\[YourUsername]\AppData\Local\Android\Sdk`
   (แทน [YourUsername] ด้วยชื่อผู้ใช้ของคุณ)

### แก้ไข PATH
ใน **System Variables** หา **Path** แล้วคลิก **Edit**:
1. คลิก **New** และเพิ่ม: `%JAVA_HOME%\bin`
2. คลิก **New** และเพิ่ม: `%ANDROID_HOME%\platform-tools`
3. คลิก **New** และเพิ่ม: `%ANDROID_HOME%\tools`
4. คลิก **New** และเพิ่ม: `%ANDROID_HOME%\tools\bin`

### ตรวจสอบการตั้งค่า
**Restart PowerShell** แล้วทดสอบ:
```powershell
echo $env:JAVA_HOME
echo $env:ANDROID_HOME
java -version
adb version
```

## 📱 ขั้นตอนที่ 4: สร้าง Android Virtual Device (AVD)

### สร้าง Emulator
1. เปิด Android Studio
2. ไป **Tools > AVD Manager**
3. คลิก **Create Virtual Device**
4. เลือกอุปกรณ์:
   - **Phone** category
   - เลือก **Pixel 7** หรือ **Pixel 6**
5. เลือก System Image:
   - **API Level 34** (Android 14)
   - ถ้าไม่มีให้คลิก **Download** ข้าง API 34
6. ตั้งค่า AVD:
   - **AVD Name**: `Pixel_7_API_34`
   - **Startup orientation**: Portrait
   - คลิก **Finish**

### ทดสอบ Emulator
1. ใน AVD Manager คลิก **Play** (▶️) ข้าง AVD ที่สร้าง
2. รอให้ emulator เปิดขึ้นมา (ครั้งแรกอาจใช้เวลา 2-5 นาที)

## 🚀 ขั้นตอนที่ 5: Build และรัน App

### วิธีที่ 1: ใช้ Expo CLI (แนะนำ)

#### เตรียม Project
```powershell
# ไปที่โฟลเดอร์โปรเจค
cd "C:\path\to\your\expo-barcode-scanner-app"

# ติดตั้ง dependencies
npm install

# สร้าง native code
npx expo prebuild --platform android
```

#### รัน Development Build
```powershell
# เปิด emulator ก่อน หรือเชื่อมต่อมือถือ
npx expo run:android
```

### วิธีที่ 2: ใช้ Android Studio โดยตรง

#### เปิด Project ใน Android Studio
1. เปิด Android Studio
2. เลือก **Open an Existing Project**
3. เลือกโฟลเดอร์ `android` ในโปรเจค
4. รอให้ Gradle sync เสร็จ (อาจใช้เวลา 5-10 นาที ครั้งแรก)

#### Build และรัน
1. ตรวจสอบว่า emulator เปิดอยู่ หรือมือถือเชื่อมต่ออยู่
2. คลิก **Run** button (▶️) หรือกด **Shift + F10**
3. เลือกอุปกรณ์ที่ต้องการรัน
4. รอให้ build และติดตั้งเสร็จ

## 📱 การใช้งานกับมือถือจริง

### เปิด Developer Options
1. ไป **Settings > About phone**
2. แตะ **Build number** 7 ครั้ง
3. กลับไป **Settings > Developer options**
4. เปิด **USB debugging**

### เชื่อมต่อและรัน
1. เชื่อมต่อมือถือกับคอมพิวเตอร์ด้วย USB
2. อนุญาต USB debugging บนมือถือ
3. ตรวจสอบการเชื่อมต่อ:
   ```powershell
   adb devices
   ```
4. รัน app:
   ```powershell
   npx expo run:android
   ```

## 🔧 การแก้ไขปัญหาที่พบบ่อย

### ปัญหา: JAVA_HOME not set
**แก้ไข**: ตรวจสอบ environment variables และ restart PowerShell

### ปัญหา: SDK not found
**แก้ไข**: ตรวจสอบ ANDROID_HOME และติดตั้ง SDK ใน Android Studio

### ปัญหา: Emulator ช้า
**แก้ไข**: 
- เปิด Hardware Acceleration (HAXM)
- เพิ่ม RAM ให้ AVD
- ใช้ x86_64 image แทน ARM

### ปัญหา: Gradle Configuration Cache Error
**สาเหตุ**: React Native ใช้ Node.js commands ระหว่าง Gradle configuration ซึ่งไม่เข้ากับ configuration cache
**แก้ไข**:
```powershell
# วิธีที่ 1: Build โดยปิด configuration cache
cd android
./gradlew assembleDebug --no-configuration-cache

# วิธีที่ 2: ใช้ Expo CLI แทน
cd ..
npx expo run:android --no-build-cache

# วิธีที่ 3: แก้ไขใน gradle.properties (แนะนำ)
# เปลี่ยน org.gradle.configuration-cache=true เป็น false
```

### ปัญหา: Build failed
**แก้ไข**:
```powershell
# ลบ cache และ build ใหม่
cd android
./gradlew clean
cd ..
npx expo run:android
```

### ปัญหา: Metro bundler error
**แก้ไข**:
```powershell
# Reset Metro cache
npx expo start --clear
```

### ปัญหา: Deprecated Gradle features
**แก้ไข**: 
```powershell
# ดู warning ทั้งหมด
./gradlew assembleDebug --warning-mode all

# หรือใช้ Expo CLI ที่จัดการ Gradle ให้
npx expo run:android
```

### ปัญหา: INSTALL_FAILED_UPDATE_INCOMPATIBLE
**สาเหตุ**: มี app เวอร์ชันเก่าที่มี signature ต่างกันติดตั้งอยู่
**แก้ไข**:
```powershell
# ลบ app เก่าออกจากอุปกรณ์
adb uninstall com.cipherlab.scanbarcodeapp

# ติดตั้งใหม่
adb install android\app\build\outputs\apk\debug\app-debug.apk

# หรือใช้ Expo CLI ที่จะจัดการให้อัตโนมัติ
npx expo run:android
```

## ✅ การตรวจสอบความสำเร็จ

### ตรวจสอบว่า Build สำเร็จ
```powershell
# ตรวจสอบว่ามี APK file
ls android\app\build\outputs\apk\debug\app-debug.apk

# ตรวจสอบขนาดไฟล์ (ควรมีขนาดประมาณ 20-50 MB)
Get-ChildItem android\app\build\outputs\apk\debug\app-debug.apk | Select-Object Name, Length
```

### ตรวจสอบการติดตั้งบนอุปกรณ์
```powershell
# ดูรายการ app ที่ติดตั้ง
adb shell pm list packages | findstr scanbarcodeapp

# เปิด app บนอุปกรณ์
adb shell am start -n com.cipherlab.scanbarcodeapp/.MainActivity
```

### สัญญาณความสำเร็จ
- ✅ **BUILD SUCCESSFUL** ปรากฏใน terminal
- ✅ ไฟล์ `app-debug.apk` ถูกสร้างขึ้น
- ✅ App ติดตั้งและเปิดได้บนอุปกรณ์
- ✅ QR Code scanner ทำงานได้ปกติ

## 📝 คำสั่งที่มีประโยชน์

### ตรวจสอบอุปกรณ์ที่เชื่อมต่อ
```powershell
adb devices
```

### ดู logs ของ app
```powershell
adb logcat | findstr "ReactNativeJS"
```

### ติดตั้ง APK ด้วยตนเอง
```powershell
adb install path/to/app.apk
```

### เปิด app บนอุปกรณ์
```powershell
adb shell am start -n com.cipherlab.scanbarcodeapp/.MainActivity
```

## 🎯 Build สำหรับ Production

### สร้าง Release APK
```powershell
cd android
./gradlew assembleRelease
```
APK จะอยู่ที่: `android/app/build/outputs/apk/release/app-release.apk`

### สร้าง AAB (สำหรับ Play Store)
```powershell
cd android
./gradlew bundleRelease
```
AAB จะอยู่ที่: `android/app/build/outputs/bundle/release/app-release.aab`

## 🔐 การ Sign APK

### สร้าง Keystore
```powershell
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

### แก้ไข android/app/build.gradle
```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file('my-release-key.keystore')
            storePassword 'your-password'
            keyAlias 'my-key-alias'
            keyPassword 'your-password'
        }
    }
    buildTypes {
        release {
            ...
            signingConfig signingConfigs.release
        }
    }
}
```

## 📚 เอกสารเพิ่มเติม

- [Android Studio Documentation](https://developer.android.com/studio/intro)
- [Expo Development Build](https://docs.expo.dev/development/build/)
- [React Native Android Setup](https://reactnative.dev/docs/environment-setup)

## 💡 Tips สำหรับการพัฒนา

1. **ใช้ Hot Reload**: แก้ไขโค้ดแล้วเห็นผลทันที
2. **ใช้ Flipper**: สำหรับ debug และ inspect
3. **ตั้งค่า Gradle Daemon**: เพื่อ build เร็วขึ้น
4. **ใช้ Physical Device**: ทดสอบ performance ที่แท้จริง

---

---

## 🎉 สรุป: Build สำเร็จแล้ว!

คุณได้ build แอป Android สำเร็จแล้วด้วยขั้นตอนต่อไปนี้:

### ✅ สิ่งที่เราทำสำเร็จ:
1. **ติดตั้ง Java JDK 17** - ✅ เสร็จแล้ว
2. **ติดตั้ง Android Studio และ SDK** - ✅ เสร็จแล้ว  
3. **ตั้งค่า Environment Variables** - ✅ เสร็จแล้ว
4. **แก้ไข Gradle Configuration Cache** - ✅ เสร็จแล้ว
5. **Build APK สำเร็จ** - ✅ ขนาด 91.8 MB
6. **ติดตั้งบนอุปกรณ์** - ✅ เสร็จแล้ว

### 🚀 คำสั่งสำหรับ Build ครั้งต่อไป:
```powershell
# Build และรันบนอุปกรณ์ (แนะนำ)
npx expo run:android

# หรือ Build เฉพาะ APK
cd android
./gradlew assembleDebug
```

### 📱 ไฟล์ APK อยู่ที่:
```
android\app\build\outputs\apk\debug\app-debug.apk
```

**หมายเหตุ**: คู่มือนี้เขียนสำหรับ Windows โดยเฉพาะ สำหรับ macOS หรือ Linux อาจมีขั้นตอนแตกต่างกันบ้าง