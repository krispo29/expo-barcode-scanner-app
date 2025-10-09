import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Platform, StyleSheet, Switch, Text, Vibration, View } from "react-native";

type Customer = { id: string; name: string };
const CUSTOMERS: Customer[] = [
  { id: "HPC0222", name: "HPC0222" }, // ตัวอย่างจากไฟล์
  { id: "ACME", name: "ACME Co." },
];

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);

  // UI state
  const [customer, setCustomer] = useState<Customer | null>(CUSTOMERS[0]);
  const [autoEnter, setAutoEnter] = useState(true);
  const [last, setLast] = useState<string>("");
  const [scanned, setScanned] = useState(false); // กันยิงซ้ำ
  const [queue, setQueue] = useState<string[]>([]); // offline queue ง่าย ๆ

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  const barcodeTypes = useMemo(
    () => ["qr", "ean13", "ean8", "upcA", "code39", "code93", "code128", "itf14", "datamatrix", "pdf417"],
    []
  );

  if (!permission) return <Center><Text>กำลังขอสิทธิ์กล้อง…</Text></Center>;
  if (!permission.granted) {
    return (
      <Center>
        <Text>ต้องการสิทธิ์กล้องเพื่อสแกน</Text>
        <Button title="อนุญาตการใช้กล้อง" onPress={requestPermission} />
      </Center>
    );
  }

  async function handleDetected(code: string) {
    if (scanned) return;
    setScanned(true);
    setLast(code);
    try { Vibration.vibrate(Platform.OS === "android" ? 30 : 200); } catch {}

    if (autoEnter && customer) {
      try {
        await submitScan({ customerId: customer.id, trackingNo: normalize(code) });
        Alert.alert("บันทึกสำเร็จ", `${customer.name} • ${code}`, [{ text: "OK", onPress: () => setScanned(false) }]);
      } catch (e: any) {
        // เก็บคิวออฟไลน์ถ้าเน็ตล้ม
        setQueue((q) => [code, ...q]);
        Alert.alert("บันทึกไม่สำเร็จ", `${String(e?.message || e)}`);
        setScanned(false);
      }
    } else {
      Alert.alert("สแกนแล้ว", code, [{ text: "OK", onPress: () => setScanned(false) }]);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      {/* แถบควบคุมเหมือนในเว็บ: Customer, Auto Enter */}
      <View style={styles.toolbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Customer*</Text>
          <View style={styles.row}>
            {CUSTOMERS.map((c) => (
              <Button key={c.id} title={c.name} onPress={() => setCustomer(c)} color={customer?.id === c.id ? undefined : "#888"} />
            ))}
          </View>
        </View>
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <Text style={styles.label}>Auto Enter</Text>
          <Switch value={autoEnter} onValueChange={setAutoEnter} />
        </View>
      </View>

      {/* กล้องสแกน */}
      <CameraView
        ref={camRef}
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes }}
        onBarcodeScanned={(res) => {
          const code = String(res?.data ?? "").trim();
          if (code) handleDetected(code);
        }}
      />

      {/* กรอบเล็ง */}
      <View pointerEvents="none" style={styles.overlay}><View style={styles.frame} /></View>

      {/* ข้อมูลล่างจอ */}
      <View style={styles.bottom}>
        <Text selectable style={styles.lastText}>Last: {last || "-"}</Text>
        <Button title="รีเซ็ตสแกน" onPress={() => setScanned(false)} />
      </View>
    </View>
  );
}

function Center({ children }: any) {
  return <View style={{ flex:1, alignItems:"center", justifyContent:"center" }}>{children}</View>;
}

function normalize(s: string) {
  // กติกาเล็ก ๆ: ตัดช่องว่าง/อักขระไม่จำเป็น
  return s.replace(/\s+/g, "");
}

async function submitScan(payload: { customerId: string; trackingNo: string }) {
  // TODO: เปลี่ยน URL ให้ตรง backend คุณ
  const res = await fetch("https://your-api.example.com/released/scans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, scannedAt: new Date().toISOString(), source: "mobile" }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `HTTP ${res.status}`);
  }
}

const styles = StyleSheet.create({
  toolbar: { flexDirection:"row", gap:12, padding:12, backgroundColor:"#f7f7f7" },
  label: { fontWeight:"600", marginBottom:6 },
  row: { flexDirection:"row", gap:8, flexWrap:"wrap" },
  overlay: { position:"absolute", top:100, left:0, right:0, alignItems:"center" },
  frame: { width:260, height:260, borderWidth:3, borderRadius:16, borderColor:"rgba(255,255,255,0.9)" },
  bottom: { position:"absolute", left:0, right:0, bottom:0, padding:12, backgroundColor:"rgba(0,0,0,0.4)" },
  lastText: { color:"#fff", marginBottom:8 }
});
