# คู่มือการติดตั้งแอปพลิเคชันลงบน CipherLab RS51 (ภาษาไทย)

เอกสารนี้จะแนะนำวิธีการ Build และติดตั้งแอปพลิเคชันนี้ลงบนเครื่องคอมพิวเตอร์พกพา **CipherLab RS51** (Android) เพื่อให้สามารถใช้งานได้โดยไม่ต้องผ่าน Expo Go

## สิ่งที่ต้องเตรียม (Prerequisites)

1.  **EAS CLI**: ตรวจสอบว่าติดตั้ง EAS CLI แล้ว หากยังไม่มีให้ติดตั้งด้วยคำสั่ง:
    ```bash
    npm install -g eas-cli
    ```
2.  **Expo Account**: คุณต้องมีบัญชี Expo และล็อกอินผ่าน Terminal:
    ```bash
    eas login
    ```
3.  **สาย USB**: สำหรับเชื่อมต่อเครื่อง RS51 เข้ากับคอมพิวเตอร์
4.  **เปิด Developer Options และ USB Debugging บนเครื่อง RS51**:
    - ไปที่ **Settings > About phone**
    - แตะที่ **Build number** ประมาณ 7 ครั้งจนขึ้นว่า "You are now a developer!"
    - กลับไปที่ **Settings > System > Developer options**
    - เปิดใช้งาน **USB debugging**

---

## ขั้นตอนที่ 1: สร้างไฟล์ APK (Build APK)

เราจะใช้ EAS Build ในการสร้างไฟล์ APK สำหรับติดตั้งลงเครื่อง

1.  เปิด Terminal ในโปรเจกต์นี้
2.  รันคำสั่งเพื่อเริ่ม Build (เลือกใช้โปรไฟล์ `preview` หรือ `production` ซึ่งถูกตั้งค่าให้สร้าง APK ไว้แล้วใน `eas.json`):

    ```bash
    eas build --platform android --profile preview --local
    ```
    *หมายเหตุ: หากต้องการให้ Build บน Cloud ของ Expo (ไม่ต้องใช้ทรัพยากรเครื่องตัวเอง) ให้ตัด `--local` ออก แต่ต้องรอคิวหากใช้บัญชีฟรี*

    ```bash
    eas build --platform android --profile preview
    ```

3.  รอจนกว่ากระบวนการ Build จะเสร็จสิ้น
    - หาก Build บน Cloud: คุณจะได้รับ Link สำหรับดาวน์โหลดไฟล์ `.apk`
    - หาก Build แบบ Local: ไฟล์ `.apk` จะถูกสร้างขึ้นในโฟลเดอร์ของโปรเจกต์

---

## ขั้นตอนที่ 2: ติดตั้งลงเครื่อง RS51

มี 2 วิธีหลักในการนำไฟล์ APK ไปติดตั้งบนเครื่อง:

### วิธีที่ 1: ติดตั้งผ่าน ADB (แนะนำสำหรับนักพัฒนา)

หากคุณติดตั้ง Android SDK Platform-tools (มีคำสั่ง `adb`) ไว้แล้ว:

1.  เสียบสาย USB เชื่อมต่อ RS51 กับคอมพิวเตอร์
2.  รันคำสั่ง:
    ```bash
    adb install path/to/your-app.apk
    ```
    *(เปลี่ยน `path/to/your-app.apk` เป็นที่อยู่ของไฟล์ที่ได้จากขั้นตอนที่ 1)*

### วิธีที่ 2: คัดลอกไฟล์ลงเครื่องโดยตรง

1.  เสียบสาย USB เชื่อมต่อ RS51 กับคอมพิวเตอร์
2.  บนเครื่อง RS51 ให้เลือกโหมด USB เป็น **File Transfer**
3.  บนคอมพิวเตอร์ ให้เปิด File Explorer แล้วเข้าไปที่ Drive ของ RS51
4.  ลากไฟล์ `.apk` ที่ได้ ไปวางไว้ในโฟลเดอร์ `Download` (หรือโฟลเดอร์ใดก็ได้) ของ RS51
5.  บนเครื่อง RS51:
    - เปิดแอป **Files** (หรือ File Manager)
    - ไปที่โฟลเดอร์ที่วางไฟล์ไว้
    - แตะที่ไฟล์ `.apk` เพื่อติดตั้ง
    - *หากเครื่องถามสิทธิ์ ให้กด Allow installation from unknown sources (อนุญาตให้ติดตั้งแอปจากแหล่งที่ไม่รู้จัก)*

---

## การตั้งค่าเพิ่มเติมสำหรับ Scanner (RS51)

เพื่อให้แอปทำงานร่วมกับ Barcode Scanner ของ RS51 ได้ดีที่สุด (ยิงแล้วตัวอักษรเข้าทันที):

1.  ไปที่ **ReaderConfig** (หรือ App setting ของเครื่องสแกน)
2.  ตั้งค่า **Output Mode** เป็น **Keyboard Emulation** (หรือ Keystroke)
3.  ตั้งค่า **Auto Enter** หรือ **Append Enter** เพื่อให้เมื่อยิงเสร็จแล้วมีการกด Enter อัตโนมัติ (แอปนี้รองรับโหมด Auto Enter)

ขอให้สนุกกับการใช้งาน!
