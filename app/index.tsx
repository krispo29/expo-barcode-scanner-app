import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, Vibration, View } from "react-native";
import { CameraView, BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";

type Customer = { id: string; name: string; description?: string };

type ScanRecord = {
  id: string;
  customerId: string;
  code: string;
  scannedAt: string;
  mode: "auto" | "manual";
};

const CUSTOMERS: Customer[] = [
  { id: "HPC0222", name: "HPC0222", description: "ลูกค้าในตัวอย่างเอกสาร" },
  { id: "HEYNATURE", name: "Heynature", description: "ทดสอบสำหรับ shipment" },
  { id: "ACME", name: "ACME Co.", description: "ลูกค้าสมมติ" },
];

export default function IndexScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [customer, setCustomer] = useState<Customer>(CUSTOMERS[0]);
  const [autoEnter, setAutoEnter] = useState(true);
  const [input, setInput] = useState("");
  const [scannedLock, setScannedLock] = useState(false);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [lastStatus, setLastStatus] = useState<string>("-");

  const cameraRef = useRef<CameraView>(null);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idCounter = useRef(0);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    return () => {
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
    };
  }, []);

  const handleDetected = useCallback(
    async (rawValue: string, mode: "auto" | "manual") => {
      if (scannedLock) return;
      setScannedLock(true);
      const normalized = normalizeTracking(rawValue);
      if (!normalized) {
        Alert.alert("ไม่พบ Tracking No.", "ข้อมูลที่ได้ว่างเปล่าหรือไม่ใช่ตัวเลข");
        setScannedLock(false);
        return;
      }

      try {
        try {
          Vibration.vibrate(Platform.OS === "android" ? 30 : 200);
        } catch (error) {
          // อุปกรณ์บางเครื่องอาจไม่รองรับการสั่น ไม่ต้องทำอะไรต่อ
        }

        await fakeSubmit({ customerId: customer.id, trackingNo: normalized, mode });

        idCounter.current += 1;
        const record: ScanRecord = {
          id: `${Date.now()}-${idCounter.current}`,
          customerId: customer.id,
          code: normalized,
          scannedAt: new Date().toISOString(),
          mode,
        };
        setHistory((prev) => [record, ...prev].slice(0, 15));
        setLastStatus(`${normalized} • ${customer.name}`);
        setInput(normalized);
      } catch (error: any) {
        Alert.alert("บันทึกไม่สำเร็จ", error?.message ?? String(error));
      } finally {
        if (unlockTimer.current) clearTimeout(unlockTimer.current);
        unlockTimer.current = setTimeout(() => setScannedLock(false), 900);
      }
    },
    [customer.id, customer.name, scannedLock]
  );

  const onBarcodeScanned = useCallback(
    (scan: BarcodeScanningResult) => {
      const raw = String(scan?.data ?? "").trim();
      if (!raw) return;
      const normalized = normalizeTracking(raw);
      if (!normalized) return;

      if (autoEnter) {
        handleDetected(normalized, "auto");
      } else {
        try {
          Vibration.vibrate(Platform.OS === "android" ? 20 : 120);
        } catch (error) {
          // ignore vibration errors
        }
        setInput(normalized);
        setLastStatus(`${normalized} • ${customer.name}`);
        if (unlockTimer.current) clearTimeout(unlockTimer.current);
        setScannedLock(true);
        unlockTimer.current = setTimeout(() => setScannedLock(false), 600);
      }
    },
    [autoEnter, customer.name, handleDetected]
  );

  if (!permission) {
    return (
      <Centered>
        <StatusBar style="dark" />
        <Text style={styles.permissionTitle}>กำลังตรวจสอบสิทธิ์กล้อง…</Text>
      </Centered>
    );
  }

  if (!permission.granted) {
    return (
      <Centered>
        <StatusBar style="dark" />
        <Text style={styles.permissionTitle}>ต้องการสิทธิ์ในการใช้กล้องเพื่อสแกนบาร์โค้ด</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>อนุญาตการใช้กล้อง</Text>
        </TouchableOpacity>
      </Centered>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.appShell}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.breadcrumbs}>
            <Text style={styles.breadcrumbText}>Dashboard</Text>
            <Separator />
            <Text style={styles.breadcrumbText}>Import</Text>
            <Separator />
            <Text style={styles.breadcrumbText}>Released</Text>
            <Separator />
            <Text style={[styles.breadcrumbText, styles.breadcrumbActive]}>Scan</Text>
          </View>

          <View style={styles.filterCard}>
            <View style={styles.filterRow}>
              <View style={styles.filterBlock}>
                <Text style={styles.label}>Customer*</Text>
                <View style={styles.customerPills}>
                  {CUSTOMERS.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.pill,
                        item.id === customer.id && styles.pillActive,
                      ]}
                      onPress={() => setCustomer(item)}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          item.id === customer.id && styles.pillTextActive,
                        ]}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.toggleBlock}>
                <Text style={styles.label}>Auto Enter</Text>
                <Switch value={autoEnter} onValueChange={setAutoEnter} />
              </View>
            </View>

            <View style={styles.trackingRow}>
              <View style={styles.inputWrapper}>
                <Text style={styles.label}>Scan Tracking*</Text>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="สแกนหรือกรอก Tracking No."
                  style={styles.input}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </View>
              {!autoEnter && (
                <TouchableOpacity
                  onPress={() => handleDetected(input, "manual")}
                  style={styles.primaryButton}
                  disabled={!input.trim()}
                >
                  <Text style={styles.primaryButtonText}>บันทึก</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

        </ScrollView>

        <View style={styles.cameraSheet}>
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraTitle}>Scanner</Text>
            <Text style={styles.cameraStatus}>Last: {lastStatus}</Text>
          </View>

          <View style={styles.cameraFrame}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{ barcodeTypes: SUPPORTED_TYPES }}
              facing="back"
              onBarcodeScanned={onBarcodeScanned}
            />
            <View style={styles.focusFrame} pointerEvents="none" />
            {!autoEnter && (
              <View style={styles.manualOverlay} pointerEvents="none">
                <Text style={styles.manualOverlayText}>
                  เปิด Auto Enter เพื่อให้บันทึกทันทีที่สแกน
                </Text>
              </View>
            )}
          </View>

          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>ประวัติการสแกนล่าสุด</Text>
            <Text style={styles.historyHint}>แสดง 15 รายการล่าสุด</Text>
          </View>
          {history.length === 0 ? (
            <View style={styles.historyEmpty}>
              <Text style={styles.historyEmptyText}>ยังไม่มีรายการสแกน</Text>
            </View>
          ) : (
            <ScrollView style={styles.historyList}>
              {history.map((item) => (
                <View key={item.id} style={styles.historyRow}>
                  <View style={styles.historyBadge}>
                    <Text style={styles.historyBadgeText}>{item.customerId}</Text>
                  </View>
                  <View style={styles.historyDetail}>
                    <Text style={styles.historyCode}>{item.code}</Text>
                    <Text style={styles.historyMeta}>
                      {new Date(item.scannedAt).toLocaleString()} • {item.mode === "auto" ? "Auto" : "Manual"}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const SUPPORTED_TYPES = [
  "qr",
  "ean13",
  "ean8",
  "upcA",
  "upcE",
  "code39",
  "code93",
  "code128",
  "itf14",
  "pdf417",
  "aztec",
  "datamatrix",
] as const;

type SubmitPayload = { customerId: string; trackingNo: string; mode: "auto" | "manual" };

async function fakeSubmit(payload: SubmitPayload) {
  console.log("submit", payload);
  await new Promise((resolve) => setTimeout(resolve, 300));
  return true;
}

function normalizeTracking(value: string) {
  const onlyDigits = value.replace(/[^0-9A-Za-z]/g, "");
  return onlyDigits.trim().toUpperCase();
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f7fb" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#fff" },
  permissionTitle: { fontSize: 18, textAlign: "center", marginBottom: 16, color: "#1a1a1a", fontWeight: "600" },
  primaryButton: { backgroundColor: "#2d6cdf", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  appShell: { flex: 1, flexDirection: "column" },
  scrollContent: { padding: 20, paddingBottom: 160 },
  breadcrumbs: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
  breadcrumbText: { color: "#9aa3b5", fontSize: 14 },
  breadcrumbActive: { color: "#2d6cdf", fontWeight: "600" },
  filterCard: { backgroundColor: "#fff", borderRadius: 18, padding: 20, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginBottom: 20 },
  filterRow: { flexDirection: "row", justifyContent: "space-between", gap: 20, marginBottom: 18 },
  filterBlock: { flex: 1 },
  label: { fontWeight: "600", color: "#2c3a4b", marginBottom: 8, fontSize: 15 },
  customerPills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "#eef2fb" },
  pillActive: { backgroundColor: "#2d6cdf" },
  pillText: { color: "#5b6b85", fontWeight: "600" },
  pillTextActive: { color: "#fff" },
  toggleBlock: { alignItems: "flex-start", gap: 12 },
  trackingRow: { flexDirection: "row", alignItems: "flex-end", gap: 16 },
  inputWrapper: { flex: 1 },
  input: { backgroundColor: "#f1f4fb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: "#1f2937" },
  cameraSheet: { backgroundColor: "#f9fafc", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 24 },
  cameraHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  cameraTitle: { fontSize: 18, fontWeight: "700", color: "#1f2937" },
  cameraStatus: { color: "#6b7280" },
  cameraFrame: { height: 280, borderRadius: 24, overflow: "hidden", backgroundColor: "#000", marginBottom: 16 },
  focusFrame: { position: "absolute", top: "15%", left: "12%", right: "12%", bottom: "15%", borderWidth: 3, borderRadius: 18, borderColor: "rgba(255,255,255,0.8)" },
  manualOverlay: { position: "absolute", bottom: 16, left: 16, right: 16, padding: 12, borderRadius: 12, backgroundColor: "rgba(17,24,39,0.75)" },
  manualOverlayText: { color: "#fff", textAlign: "center" },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  historyTitle: { fontSize: 16, fontWeight: "600", color: "#1f2937" },
  historyHint: { color: "#9aa3b5" },
  historyEmpty: { paddingVertical: 32, alignItems: "center" },
  historyEmptyText: { color: "#9aa3b5" },
  historyList: { maxHeight: 220, marginTop: 12 },
  historyRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  historyBadge: { backgroundColor: "#e9efff", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginRight: 12 },
  historyBadgeText: { color: "#2d6cdf", fontWeight: "700" },
  historyDetail: { flex: 1 },
  historyCode: { fontSize: 16, fontWeight: "600", color: "#111827" },
  historyMeta: { color: "#6b7280", marginTop: 4, fontSize: 12 },
});

function Separator() {
  return <Text style={{ color: "#d1d9e6" }}>/</Text>;
}
