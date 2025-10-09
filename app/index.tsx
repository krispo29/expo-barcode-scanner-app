import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function IndexScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [customer, setCustomer] = useState<Customer>(CUSTOMERS[0]);
  const [autoEnter, setAutoEnter] = useState(true);
  const [input, setInput] = useState("");
  const [scannedLock, setScannedLock] = useState(false);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [lastStatus, setLastStatus] = useState<string>("-");
  const [isScanning, setIsScanning] = useState(true);
  const [historyFullScreen, setHistoryFullScreen] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idCounter = useRef(0);
  const scanAnimation = useRef(new Animated.Value(0)).current;
  const panelAnimation = useRef(new Animated.Value(0)).current;
  const panelCurrent = useRef(0);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const previousScanningState = useRef(true);
  const historyPanelState = useRef<boolean | null>(null);

  const safeAreaHeight = screenHeight - insets.top - insets.bottom;
  const headerApproxHeight = 80;
  const collapsedCameraHeight = Math.min(screenHeight * 0.42, screenWidth + 80);
  const maxPanelHeightAvailable = Math.max(
    0,
    safeAreaHeight - headerApproxHeight - 16
  );
  const desiredCollapsedHeight =
    safeAreaHeight - headerApproxHeight - collapsedCameraHeight;
  const collapsedPanelHeight = Math.max(
    Math.min(desiredCollapsedHeight, maxPanelHeightAvailable),
    Math.min(320, maxPanelHeightAvailable)
  );
  const expandedPanelHeight = Math.max(
    collapsedPanelHeight,
    maxPanelHeightAvailable
  );

  useEffect(() => {
    const id = panelAnimation.addListener(({ value }) => {
      panelCurrent.current = value;
    });
    return () => {
      panelAnimation.removeListener(id);
    };
  }, [panelAnimation]);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    // Animate scan line
    const animateScanLine = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnimation, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnimation, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    if (isScanning) {
      animateScanLine();
    }

    return () => {
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
    };
  }, [isScanning, scanAnimation]);

  const applyPanelState = useCallback(
    (expand: boolean) => {
      panelAnimation.stopAnimation();
      setPanelExpanded(expand);
      Animated.timing(panelAnimation, {
        toValue: expand ? 1 : 0,
        duration: 260,
        useNativeDriver: false,
      }).start();

      if (expand) {
        previousScanningState.current = isScanning;
        if (isScanning) {
          setIsScanning(false);
        }
      } else if (previousScanningState.current) {
        setIsScanning(true);
      }
    },
    [isScanning, panelAnimation]
  );

  const togglePanel = useCallback(() => {
    applyPanelState(!panelExpanded);
  }, [applyPanelState, panelExpanded]);

  const renderHistoryRecords = useCallback(
    (records: ScanRecord[]) =>
      records.map((item) => {
        const scanTime = new Date(item.scannedAt);
        const now = new Date();
        const diffMinutes = Math.floor(
          (now.getTime() - scanTime.getTime()) / (1000 * 60)
        );

        let timeText = "";
        if (diffMinutes < 1) {
          timeText = "เมื่อสักครู่";
        } else if (diffMinutes < 60) {
          timeText = `${diffMinutes} นาทีที่แล้ว`;
        } else if (diffMinutes < 1440) {
          const hours = Math.floor(diffMinutes / 60);
          timeText = `${hours} ชั่วโมงที่แล้ว`;
        } else {
          timeText = scanTime.toLocaleDateString("th-TH", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
        }
        const historyIndex = history.findIndex((record) => record.id === item.id);
        const displayOrder = historyIndex >= 0 ? history.length - historyIndex : 0;
        const isLatest = historyIndex === 0;

        return (
          <View
            key={item.id}
            style={[styles.historyItem, isLatest && styles.historyItemLatest]}
          >
            <View style={styles.historyLeft}>
              <View
                style={[styles.historyIcon, isLatest && styles.historyIconLatest]}
              >
                <Text style={styles.historyIconText}>
                  {isLatest ? "🆕" : "📦"}
                </Text>
              </View>
              <View style={styles.historyNumber}>
                <Text style={styles.historyNumberText}>#{displayOrder}</Text>
              </View>
            </View>

            <View style={styles.historyContent}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyCode}>{item.code}</Text>
                <View
                  style={[
                    styles.historyBadge,
                    item.mode === "auto"
                      ? styles.historyBadgeAuto
                      : styles.historyBadgeManual,
                  ]}
                >
                  <Text style={styles.historyBadgeText}>
                    {item.mode === "auto" ? "AUTO" : "MANUAL"}
                  </Text>
                </View>
              </View>

              <View style={styles.historyDetails}>
                <Text style={styles.historyCustomer}>
                  👤{" "}
                  {CUSTOMERS.find((c) => c.id === item.customerId)?.name ||
                    item.customerId}
                </Text>
                <Text style={styles.historyTime}>🕐 {timeText}</Text>
                <Text style={styles.historyDateTime}>
                  📅{" "}
                  {scanTime.toLocaleString("th-TH", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </Text>
              </View>
            </View>
          </View>
        );
      }),
    [history]
  );

  const openHistoryFullScreen = useCallback(() => {
    historyPanelState.current = panelExpanded;
    if (!panelExpanded) {
      applyPanelState(true);
    }
    setHistoryFullScreen(true);
  }, [applyPanelState, panelExpanded]);

  const closeHistoryFullScreen = useCallback(() => {
    setHistoryFullScreen(false);
    if (historyPanelState.current === false) {
      applyPanelState(false);
    }
    historyPanelState.current = null;
  }, [applyPanelState]);

  const panResponder = useMemo(() => {
    const gestureRange = Math.max(collapsedCameraHeight, 1);

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (Math.abs(gesture.dy) < 6) return false;
        return Math.abs(gesture.dy) > Math.abs(gesture.dx);
      },
      onPanResponderGrant: () => {
        panelAnimation.stopAnimation();
      },
      onPanResponderMove: (_, gesture) => {
        const nextValue = clamp(
          panelCurrent.current - gesture.dy / gestureRange,
          0,
          1
        );
        panelAnimation.setValue(nextValue);
      },
      onPanResponderRelease: (_, gesture) => {
        const velocity = gesture.vy;
        const value = panelCurrent.current;
        let expand = panelExpanded;

        if (velocity < -0.5) {
          expand = true;
        } else if (velocity > 0.5) {
          expand = false;
        } else {
          expand = value > 0.5;
        }

        applyPanelState(expand);
      },
      onPanResponderTerminate: () => {
        applyPanelState(panelCurrent.current > 0.5);
      },
    });
  }, [applyPanelState, collapsedCameraHeight, panelAnimation, panelExpanded]);

  const cameraHeight = panelAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [collapsedCameraHeight, 0],
    extrapolate: "clamp",
  });
  const cameraOpacity = panelAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const panelHeight = panelAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [collapsedPanelHeight, expandedPanelHeight],
    extrapolate: "clamp",
  });

  const visibleHistory = panelExpanded ? history : history.slice(0, 10);
  const showingAllHistory = panelExpanded || history.length <= 10;

  const handleDetected = useCallback(
    async (rawValue: string, mode: "auto" | "manual") => {
      if (scannedLock) return;
      setScannedLock(true);
      const normalized = normalizeTracking(rawValue);
      if (!normalized) {
        Alert.alert(
          "ไม่พบ Tracking No.",
          "ข้อมูลที่ได้ว่างเปล่าหรือไม่ใช่ตัวเลข"
        );
        setScannedLock(false);
        return;
      }

      try {
        try {
          Vibration.vibrate(Platform.OS === "android" ? 30 : 200);
        } catch (error) {
          // อุปกรณ์บางเครื่องอาจไม่รองรับการสั่น ไม่ต้องทำอะไรต่อ
        }

        await fakeSubmit({
          customerId: customer.id,
          trackingNo: normalized,
          mode,
        });

        idCounter.current += 1;
        const record: ScanRecord = {
          id: `${Date.now()}-${idCounter.current}`,
          customerId: customer.id,
          code: normalized,
          scannedAt: new Date().toISOString(),
          mode,
        };
        setHistory((prev) => [record, ...prev].slice(0, 30));
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
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.permissionContainer}>
          <View style={styles.permissionIcon}>
            <Text style={styles.permissionIconText}>📷</Text>
          </View>
          <Text style={styles.permissionTitle}>กำลังตรวจสอบสิทธิ์กล้อง</Text>
          <Text style={styles.permissionSubtitle}>กรุณารอสักครู่...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.permissionContainer}>
          <View style={styles.permissionIcon}>
            <Text style={styles.permissionIconText}>🔒</Text>
          </View>
          <Text style={styles.permissionTitle}>ต้องการสิทธิ์ใช้กล้อง</Text>
          <Text style={styles.permissionSubtitle}>
            เพื่อสแกนบาร์โค้ดและ QR Code
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={requestPermission}
          >
            <Text style={styles.primaryButtonText}>อนุญาตการใช้กล้อง</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Scanner</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.headerButton,
              isScanning && styles.headerButtonActive,
              panelExpanded && styles.headerButtonDisabled,
            ]}
            onPress={() => {
              if (panelExpanded) return;
              setIsScanning(!isScanning);
            }}
            disabled={panelExpanded}
          >
            <Text
              style={[
                styles.headerButtonText,
                isScanning && styles.headerButtonTextActive,
              ]}
            >
              {isScanning ? "⏸️" : "▶️"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Camera Section */}
      <Animated.View
        style={[
          styles.cameraContainer,
          { height: cameraHeight, opacity: cameraOpacity },
        ]}
      >
        <View style={styles.cameraFrame}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: [...SUPPORTED_TYPES] }}
            facing="back"
            onBarcodeScanned={isScanning ? onBarcodeScanned : undefined}
          />

          {/* Scan overlay */}
          <View style={styles.scanOverlay} pointerEvents="none">
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />

              {/* Animated scan line */}
              {isScanning && (
                <Animated.View
                  style={[
                    styles.scanLine,
                    {
                      transform: [
                        {
                          translateY: scanAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 200],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              )}
            </View>

            <View style={styles.scanInstructions}>
              <Text style={styles.scanInstructionText}>
                {isScanning
                  ? "วางบาร์โค้ดในกรอบเพื่อสแกน"
                  : "กดปุ่มเล่นเพื่อเริ่มสแกน"}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Controls Panel */}
      <Animated.View
        style={[
          styles.controlsPanel,
          { paddingBottom: insets.bottom + 20 },
          { height: panelHeight },
        ]}
      >
        <View style={styles.panelHandleWrapper} {...panResponder.panHandlers}>
          <TouchableOpacity
            onPress={togglePanel}
            activeOpacity={0.8}
            style={styles.panelHandleTouch}
          >
            <View style={styles.panelHandle} />
            <Text style={styles.panelHandleText}>
              {panelExpanded
                ? "แตะเพื่อเปิดกล้องอีกครั้ง"
                : "เลื่อนขึ้นเพื่อดูประวัติเพิ่มเติม"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.controlsContent}>
          {/* Customer Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ลูกค้า</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.customerScroll}
            >
              {CUSTOMERS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.customerCard,
                    item.id === customer.id && styles.customerCardActive,
                  ]}
                  onPress={() => setCustomer(item)}
                >
                  <Text
                    style={[
                      styles.customerCardTitle,
                      item.id === customer.id && styles.customerCardTitleActive,
                    ]}
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={[
                      styles.customerCardSubtitle,
                      item.id === customer.id &&
                        styles.customerCardSubtitleActive,
                    ]}
                  >
                    {item.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Manual Input & Settings */}
          <View style={styles.section}>
            <View style={styles.inputSection}>
              <View style={styles.inputHeader}>
                <Text style={styles.sectionTitle}>Tracking Number</Text>
                <View style={styles.autoToggle}>
                  <Text style={styles.toggleLabel}>Auto</Text>
                  <Switch
                    value={autoEnter}
                    onValueChange={setAutoEnter}
                    trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                    thumbColor={autoEnter ? "#FFFFFF" : "#9CA3AF"}
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="กรอกหรือสแกน Tracking No."
                  style={styles.trackingInput}
                  keyboardType="default"
                  returnKeyType="done"
                  placeholderTextColor="#9CA3AF"
                />
                {!autoEnter && (
                  <TouchableOpacity
                    onPress={() => handleDetected(input, "manual")}
                    style={[
                      styles.submitButton,
                      !input.trim() && styles.submitButtonDisabled,
                    ]}
                    disabled={!input.trim()}
                  >
                    <Text style={styles.submitButtonText}>✓</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Status & History */}
          <View style={[styles.section, styles.historySection]}>
            <View style={styles.statusHeader}>
              <Text style={styles.sectionTitle}>ประวัติการสแกน</Text>
              <View style={styles.historyHeaderActions}>
                <Text style={styles.historyCount}>{history.length} รายการ</Text>
                <TouchableOpacity
                  style={styles.historyExpandButton}
                  onPress={openHistoryFullScreen}
                >
                  <Text style={styles.historyExpandButtonText}>ขยาย</Text>
                </TouchableOpacity>
              </View>
            </View>

            {lastStatus !== "-" && (
              <View style={styles.statusCard}>
                <Text style={styles.statusLabel}>สแกนล่าสุด:</Text>
                <Text style={styles.statusText}>{lastStatus}</Text>
              </View>
            )}

            {history.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyHistoryIcon}>📋</Text>
                <Text style={styles.emptyHistoryText}>
                  ยังไม่มีประวัติการสแกน
                </Text>
                <Text style={styles.emptyHistorySubtext}>
                  เริ่มสแกนบาร์โค้ดเพื่อดูประวัติ
                </Text>
              </View>
            ) : (
              <View style={styles.historyListWrapper}>
                <ScrollView
                  style={styles.historyScroll}
                  contentContainerStyle={styles.historyScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {renderHistoryRecords(visibleHistory)}

                  {!showingAllHistory && (
                    <View style={styles.historyMore}>
                      <Text style={styles.historyMoreText}>
                        และอีก {history.length - visibleHistory.length} รายการ...
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      </Animated.View>

      {historyFullScreen && (
        <View
          style={[
            styles.historyFullScreenOverlay,
            {
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 20,
            },
          ]}
        >
          <View style={styles.historyFullScreenHeader}>
            <Text style={styles.historyFullScreenTitle}>ประวัติการสแกน</Text>
            <TouchableOpacity
              onPress={closeHistoryFullScreen}
              style={styles.historyFullScreenClose}
            >
              <Text style={styles.historyFullScreenCloseText}>ปิดเต็มจอ</Text>
            </TouchableOpacity>
          </View>
          {history.length === 0 ? (
            <View style={styles.historyFullScreenEmpty}>
              <Text style={styles.emptyHistoryIcon}>📋</Text>
              <Text style={styles.emptyHistoryText}>ยังไม่มีประวัติการสแกน</Text>
              <Text style={styles.emptyHistorySubtext}>
                เริ่มสแกนบาร์โค้ดเพื่อดูประวัติ
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.historyFullScreenScroll}
              contentContainerStyle={styles.historyScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {renderHistoryRecords(history)}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const SUPPORTED_TYPES = [
  "qr",
  "ean13",
  "ean8",
  "upc_a",
  "upc_e",
  "code39",
  "code93",
  "code128",
  "itf14",
  "pdf417",
  "aztec",
  "datamatrix",
] as const;

type SubmitPayload = {
  customerId: string;
  trackingNo: string;
  mode: "auto" | "manual";
};

async function fakeSubmit(payload: SubmitPayload) {
  console.log("submit", payload);
  await new Promise((resolve) => setTimeout(resolve, 300));
  return true;
}

function normalizeTracking(value: string) {
  const onlyDigits = value.replace(/[^0-9A-Za-z]/g, "");
  return onlyDigits.trim().toUpperCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },

  // Permission Screen
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  permissionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  permissionIconText: {
    fontSize: 32,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
  },
  permissionSubtitle: {
    fontSize: 16,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  primaryButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 2,
  },

  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerButtonActive: {
    backgroundColor: "#3B82F6",
  },
  headerButtonDisabled: {
    opacity: 0.4,
  },
  headerButtonText: {
    fontSize: 18,
  },
  headerButtonTextActive: {
    color: "#FFFFFF",
  },

  // Camera
  cameraContainer: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  cameraFrame: {
    width: screenWidth - 40,
    height: screenWidth - 40,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#1F2937",
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: 240,
    height: 240,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: "#3B82F6",
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#3B82F6",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  scanInstructions: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  scanInstructionText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "500",
  },

  // Controls Panel
  controlsPanel: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 16,
    paddingHorizontal: 20,
    width: "100%",
    overflow: "hidden",
  },
  panelHandleWrapper: {
    alignItems: "center",
    paddingVertical: 4,
  },
  panelHandleTouch: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    width: "100%",
  },
  panelHandle: {
    width: 52,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E5E7EB",
    marginBottom: 6,
  },
  panelHandleText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  controlsContent: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 12,
  },

  // Customer Selection
  customerScroll: {
    flexGrow: 0,
  },
  customerCard: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginRight: 12,
    minWidth: 120,
    borderWidth: 2,
    borderColor: "transparent",
  },
  customerCardActive: {
    backgroundColor: "#EBF4FF",
    borderColor: "#3B82F6",
  },
  customerCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 2,
  },
  customerCardTitleActive: {
    color: "#1D4ED8",
  },
  customerCardSubtitle: {
    fontSize: 11,
    color: "#6B7280",
    lineHeight: 14,
  },
  customerCardSubtitleActive: {
    color: "#3B82F6",
  },

  // Input Section
  inputSection: {
    backgroundColor: "#F9FAFB",
    borderRadius: 20,
    padding: 16,
  },
  inputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  autoToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  trackingInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1F2937",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  submitButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
  },

  // Status & History
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historyCount: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  historyExpandButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  historyExpandButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  statusCard: {
    backgroundColor: "#EBF4FF",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  statusLabel: {
    fontSize: 12,
    color: "#3B82F6",
    fontWeight: "600",
    marginBottom: 4,
  },
  statusText: {
    fontSize: 15,
    color: "#1F2937",
    fontWeight: "600",
  },

  // Empty History
  emptyHistory: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyHistoryIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyHistoryText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4,
  },
  emptyHistorySubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },

  // History List
  historySection: {
    flex: 1,
    marginBottom: 0,
  },
  historyListWrapper: {
    flex: 1,
  },
  historyScroll: {
    flex: 1,
    flexGrow: 1,
  },
  historyScrollContent: {
    paddingBottom: 16,
  },
  historyFullScreenOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(17, 24, 39, 0.96)",
    paddingHorizontal: 20,
    zIndex: 50,
  },
  historyFullScreenHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  historyFullScreenTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  historyFullScreenClose: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  historyFullScreenCloseText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  historyFullScreenScroll: {
    flex: 1,
  },
  historyFullScreenEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  historyItem: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  historyItemLatest: {
    borderColor: "#3B82F6",
    backgroundColor: "#FEFEFF",
  },
  historyLeft: {
    alignItems: "center",
    marginRight: 16,
  },
  historyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  historyIconLatest: {
    backgroundColor: "#EBF4FF",
  },
  historyIconText: {
    fontSize: 18,
  },
  historyNumber: {
    backgroundColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  historyNumberText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
  },
  historyContent: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  historyCode: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    flex: 1,
  },
  historyDetails: {
    gap: 4,
  },
  historyCustomer: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },
  historyTime: {
    fontSize: 13,
    color: "#3B82F6",
    fontWeight: "600",
  },
  historyDateTime: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "400",
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  historyBadgeAuto: {
    backgroundColor: "#DBEAFE",
  },
  historyBadgeManual: {
    backgroundColor: "#FEF3C7",
  },
  historyBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#1F2937",
  },
  historyMore: {
    alignItems: "center",
    paddingVertical: 16,
  },
  historyMoreText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
});
