import { Audio as ExpoAudio } from "expo-av";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Alert,
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
import { clearStoredAuth, getValidAccessToken } from "../../utils/auth";
import api from "../../utils/api";

type ScanRecord = {
  id: string;
  code: string;
  scannedAt: string;
  mode: "auto" | "manual";
};

type ApiResponse<T = any> = {
  code: number;
  message?: string;
  data: T;
};

type PendingScan = {
  value: string;
  mode: "auto" | "manual";
};

export default function ReceiveScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const ensureAuthenticated = useCallback(async () => {
    const token = await getValidAccessToken();
    if (!token) {
      router.replace("/login");
      return null;
    }

    return token;
  }, [router]);

  // Check if ready to scan
  const canScan = true;

  const [autoEnter, setAutoEnter] = useState(true);
  const [input, setInput] = useState("");
  const [scannedLock, setScannedLock] = useState(false);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [lastStatus, setLastStatus] = useState<string>("-");

  // Sound objects for Receive: air, sea, beep
  const [soundAir, setSoundAir] = useState<ExpoAudio.Sound>();
  const [soundSea, setSoundSea] = useState<ExpoAudio.Sound>();
  const [soundBeep, setSoundBeep] = useState<ExpoAudio.Sound>();

  // Load sounds
  useEffect(() => {
    async function loadSounds() {
      try {
        const { sound: s1 } = await ExpoAudio.Sound.createAsync(
          require("../../assets/sounds/air.mp3"),
        );
        setSoundAir(s1);

        const { sound: s2 } = await ExpoAudio.Sound.createAsync(
          require("../../assets/sounds/sea.mp3"),
        );
        setSoundSea(s2);

        const { sound: s3 } = await ExpoAudio.Sound.createAsync(
          require("../../assets/sounds/beep.mp3"),
        );
        setSoundBeep(s3);
      } catch (error) {
        console.log("Error loading sounds", error);
      }
    }

    loadSounds();

    return () => {
      soundAir?.unloadAsync();
      soundSea?.unloadAsync();
      soundBeep?.unloadAsync();
    };
  }, []);

  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idCounter = useRef(0);
  const lastScanRef = useRef({ value: "", timestamp: 0 });
  const historyRef = useRef<ScanRecord[]>([]);
  const pendingScanRef = useRef<PendingScan | null>(null);

  const inputRef = useRef<TextInput | null>(null);

  // โฟกัสช่อง Tracking Number อัตโนมัติเมื่อเข้า screen
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // เคลียร์ timer ตอน unmount
  useEffect(() => {
    return () => {
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
      pendingScanRef.current = null;
    };
  }, []);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    void ensureAuthenticated();
  }, [ensureAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      void ensureAuthenticated();
    }, [ensureAuthenticated]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void ensureAuthenticated();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [ensureAuthenticated]);

  const handleLogout = async () => {
    // Safety: Prevent logout if a scan just happened (within 1000ms)
    if (Date.now() - lastScanRef.current.timestamp < 1000) {
      console.log("Logout blocked - recent scan detected");
      return;
    }

    // Safety: Prevent logout if input is focused (likely phantom click from scanner Enter key)
    if (inputRef.current?.isFocused()) {
      console.log("Logout blocked - input is focused");
      return;
    }

    Alert.alert("ออกจากระบบ", "คุณต้องการออกจากระบบหรือไม่?", [
      {
        text: "ยกเลิก",
        style: "cancel",
      },
      {
        text: "ออกจากระบบ",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              // ลบข้อมูลการเข้าสู่ระบบ
              await clearStoredAuth();

              // กลับไปหน้า login
              router.replace("/login");
            } catch (error) {
              console.error("Logout error:", error);
              Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถออกจากระบบได้");
            }
          })();
        },
      },
    ]);
  };

  const normalizeTracking = (value: string): string => {
    return value.trim().replaceAll(/[^a-zA-Z0-9]/g, "");
  };

  const clearInputAndRefocus = useCallback(() => {
    setInput("");
    setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
  }, []);

  const showReceiveAlert = useCallback(
    (trackingNo: string, message?: string) => {
      const normalizedMessage = message?.trim().toLowerCase() ?? "";
      const alreadyReceived =
        normalizedMessage.includes("already") &&
        normalizedMessage.includes("receive");

      if (alreadyReceived) {
        Alert.alert(
          "Tracking นี้ยิงรับแล้ว",
          `Tracking No. ${trackingNo} ถูกยิงรับแล้ว`,
        );
        return;
      }

      if (message?.trim()) {
        Alert.alert("ไม่สามารถยิงรับสินค้าได้", message.trim());
        return;
      }

      Alert.alert(
        "ไม่สามารถยิงรับสินค้าได้",
        "เกิดข้อผิดพลาดในการตรวจสอบ Tracking Number",
      );
    },
    [],
  );

  const handleDetected = useCallback(
    async (rawValue: string, mode: "auto" | "manual") => {
      const normalized = normalizeTracking(rawValue);
      if (!normalized) {
        Alert.alert(
          "ไม่พบ Tracking No.",
          "ข้อมูลที่ได้ว่างเปล่าหรือไม่ใช่ตัวเลข/ตัวอักษร",
        );
        return;
      }

      const now = Date.now();
      const { value: lastValue, timestamp: lastTimestamp } =
        lastScanRef.current;

      // ป้องกันการยิงซ้ำติดกัน (debounce)
      if (lastValue === normalized && now - lastTimestamp < 1500) {
        clearInputAndRefocus();
        return;
      }

      // Check if already scanned in current session history
      const isDuplicate = historyRef.current.some(
        (item) => item.code === normalized,
      );
      if (isDuplicate) {
        Alert.alert(
          "สแกนซ้ำ",
          `Tracking No. ${normalized} นี้ถูกสแกนไปแล้วในรายการปัจจุบัน`,
        );
        clearInputAndRefocus();
        if (soundBeep) {
          try {
            await soundBeep.replayAsync();
          } catch (err) {
            console.log("Error playing beep sound", err);
          }
        }
        return;
      }

      if (scannedLock) {
        pendingScanRef.current = { value: normalized, mode };
        clearInputAndRefocus();
        return;
      }
      setScannedLock(true);
      lastScanRef.current = { value: normalized, timestamp: now };

      try {
        try {
          Vibration.vibrate(Platform.OS === "android" ? 30 : 200);
        } catch {
          // บางเครื่องอาจไม่รองรับการสั่น
        }

        // เรียก API เพื่อตรวจสอบ tracking number
        console.log("=== Scan Request ===");
        console.log("Tracking No:", normalized);

        const apiUrl = process.env.EXPO_PUBLIC_API_URL;
        const endpoint = `${apiUrl}/v1/orders/received_inbound/${normalized}`;

        // ดึง access token จาก storage
        const token = await ensureAuthenticated();
        if (!token) {
          return;
        }

        console.log("Endpoint:", endpoint);

        const response = await api.get<ApiResponse>(endpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        console.log("=== Scan Response ===");
        console.log("Response:", response.data);

        if (response.data && response.data.code === 200) {
          // สแกนสำเร็จ - เล่นเสียงตาม shippingTypeCode
          const shippingType =
            response.data.data?.shippingTypeCode?.toLowerCase() || "air";

          idCounter.current += 1;
          const record: ScanRecord = {
            id: `${Date.now()}-${idCounter.current}`,
            code: normalized,
            scannedAt: new Date().toISOString(),
            mode,
          };

          setHistory((prev) => [record, ...prev].slice(0, 30));
          setLastStatus(`${normalized} • ${shippingType.toUpperCase()}`);
          setInput(""); // เคลียร์ค่าเก่าหลังสแกนสำเร็จ

          // เล่นเสียงตาม shippingTypeCode (air หรือ sea)
          try {
            if (shippingType === "sea" && soundSea) {
              await soundSea.replayAsync();
            } else if (soundAir) {
              await soundAir.replayAsync();
            }
          } catch (err) {
            console.log("Error playing sound", err);
          }

          // Refocus input
          setTimeout(() => {
            inputRef.current?.focus();
          }, 200);
        } else {
          // สแกนไม่พบข้อมูล - เล่นเสียง beep
          showReceiveAlert(normalized, response.data?.message);
          setInput(""); // เคลียร์ข้อความที่ค้างอยู่เพื่อให้ยิงกล่องต่อไปได้
          if (soundBeep) {
            try {
              await soundBeep.replayAsync();
            } catch (err) {
              console.log("Error playing beep sound", err);
            }
          }

          setTimeout(() => {
            inputRef.current?.focus();
          }, 200);
        }
      } catch (error: any) {
        console.error("Scan error:", error);
        let errorMessage = "เกิดข้อผิดพลาดในการตรวจสอบ Tracking Number";
        if (error?.response?.data?.message) {
          errorMessage = error.response.data.message;
        }

        showReceiveAlert(normalized, errorMessage);
        setInput(""); // เคลียร์ข้อความที่ค้างอยู่เพื่อให้ยิงกล่องต่อไปได้

        if (soundBeep) {
          try {
            await soundBeep.replayAsync();
          } catch (err) {
            console.log("Error playing beep sound", err);
          }
        }

        setTimeout(() => {
          inputRef.current?.focus();
        }, 200);
      } finally {
        if (unlockTimer.current) clearTimeout(unlockTimer.current);
        unlockTimer.current = setTimeout(() => {
          setScannedLock(false);
          const pendingScan = pendingScanRef.current;
          pendingScanRef.current = null;
          if (pendingScan) {
            void handleDetected(pendingScan.value, pendingScan.mode);
          }
        }, 150);
      }
    },
    [canScan, clearInputAndRefocus, scannedLock, showReceiveAlert, soundBeep],
  );

  // ใช้กับสแกนเนอร์ฮาร์ดแวร์ (RS51 ยิงแล้วส่งตัวอักษร + Enter เข้ามา)
  const handleInputChange = useCallback(
    (text: string) => {
      // Always sanitize input to prevent newline accumulation
      const sanitized = text.replaceAll(/[\r\n]/g, "");

      if (autoEnter && /[\r\n]/.test(text)) {
        setInput(sanitized);
        if (sanitized.trim()) {
          handleDetected(sanitized, "auto");
        }
        return;
      }
      setInput(sanitized);
    },
    [autoEnter, handleDetected],
  );

  const handleManualSubmit = () => {
    if (!input.trim() || !canScan) return;
    // If autoEnter is on, treat Enter key as auto scan (likely from scanner)
    // If autoEnter is off, it's definitely a manual action
    handleDetected(input, autoEnter ? "auto" : "manual");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Invisible Dummy Button - To catch scanner triggers */}
      <TouchableOpacity
        style={styles.dummyButton}
        onPress={() => {
          // Do absolutely nothing - just absorb the scanner trigger
          console.log("Dummy button triggered - ignoring");
        }}
        activeOpacity={1}
      >
        <View style={styles.dummyButtonContent} />
      </TouchableOpacity>

      {/* Compact Header - App Title + Logout */}
      <View style={styles.compactHeader}>
        <View style={styles.compactHeaderContent}>
          <Text style={styles.compactHeaderTitle}>📥 SHIP2CU Receive</Text>
        </View>
        <TouchableOpacity
          style={styles.headerLogoutButton}
          onPress={handleLogout}
          delayPressIn={200}
          activeOpacity={0.7}
        >
          <Text style={styles.headerLogoutText}>ออกจากระบบ</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Panel (Scrollable) */}
      <View
        style={[
          styles.controlsPanel,
          { paddingBottom: insets.bottom + 20, flex: 1 },
        ]}
      >
        <ScrollView
          style={styles.controlsScroll}
          contentContainerStyle={styles.controlsScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Ready to Scan Notice */}
          <View style={[styles.section, styles.readyNotice]}>
            <Text style={styles.readyNoticeTitle}>✅ พร้อมสแกนบาร์โค้ด</Text>
            <Text style={styles.readyNoticeText}>
              สามารถเริ่มสแกนบาร์โค้ดได้
            </Text>
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
                    trackColor={{ false: "#E5E7EB", true: "#10B981" }}
                    thumbColor={autoEnter ? "#FFFFFF" : "#9CA3AF"}
                  />
                </View>
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  ref={inputRef}
                  value={input}
                  onChangeText={handleInputChange}
                  placeholder="กรอกหรือสแกน Tracking No."
                  style={styles.trackingInput}
                  keyboardType="default"
                  returnKeyType="done"
                  placeholderTextColor="#9CA3AF"
                  autoCorrect={false}
                  editable={canScan}
                  onSubmitEditing={autoEnter ? handleManualSubmit : undefined}
                />
                {!autoEnter && (
                  <TouchableOpacity
                    onPress={handleManualSubmit}
                    style={[
                      styles.submitButton,
                      (!input.trim() || !canScan) &&
                        styles.submitButtonDisabled,
                    ]}
                    disabled={!input.trim() || !canScan}
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
              <Text style={styles.historyCount}>{history.length} รายการ</Text>
            </View>

            {lastStatus !== "-" && (
              <View style={styles.historyCard}>
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
                  เริ่มสแกนบาร์โค้ดเพื่อดูประวัติที่นี่
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.historyScroll}>
                {history.slice(0, 10).map((item, index) => {
                  const scanTime = new Date(item.scannedAt);
                  const isLatest = index === 0;

                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.historyItem,
                        isLatest && styles.historyItemLatest,
                      ]}
                    >
                      <View style={styles.historyLeft}>
                        <View
                          style={[
                            styles.historyIcon,
                            isLatest && styles.historyIconLatest,
                          ]}
                        >
                          <Text style={styles.historyIconText}>
                            {isLatest ? "🆕" : "📦"}
                          </Text>
                        </View>
                        <View style={styles.historyNumber}>
                          <Text style={styles.historyNumberText}>
                            #{history.length - index}
                          </Text>
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
                          <Text style={styles.historyTime}>
                            🕐 {scanTime.toLocaleString("th-TH")}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#022C22",
  },
  dummyButton: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    zIndex: -1,
  },
  dummyButtonContent: {
    width: 1,
    height: 1,
  },
  compactHeader: {
    backgroundColor: "#064E3B",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#047857",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  compactHeaderContent: {
    alignItems: "flex-start",
    flex: 1,
  },
  headerLogoutButton: {
    backgroundColor: "#EF4444",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 12,
  },
  headerLogoutText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  compactHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#34D399",
    marginBottom: 2,
  },
  compactHeaderSubtitle: {
    fontSize: 12,
    color: "#D1D5DB",
  },
  controlsPanel: {
    backgroundColor: "#F9FAFB",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 8,
  },
  controlsScroll: {
    flex: 1,
  },
  controlsScrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  selectButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectButtonActive: {
    borderColor: "#3B82F6",
    backgroundColor: "#EFF6FF",
  },
  selectButtonContent: {
    flex: 1,
  },
  selectButtonLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1F2937",
  },
  selectButtonDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  selectButtonIcon: {
    fontSize: 16,
    color: "#6B7280",
    marginLeft: 8,
  },
  selectButtonIconActive: {
    color: "#3B82F6",
  },
  dropdown: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
    color: "#6B7280",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
    paddingVertical: 4,
  },
  searchClear: {
    padding: 4,
  },
  searchClearText: {
    fontSize: 16,
    color: "#6B7280",
  },
  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F3F4F6",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  dropdownHeaderText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  dropdownHeaderHint: {
    fontSize: 12,
    color: "#6B7280",
  },
  dropdownList: {
    maxHeight: 250,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
  },
  dropdownItemActive: {
    backgroundColor: "#EFF6FF",
  },
  dropdownItemContent: {
    flex: 1,
  },
  dropdownItemTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1F2937",
  },
  dropdownItemDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  dropdownItemCheck: {
    fontSize: 18,
    color: "#3B82F6",
    marginLeft: 8,
  },
  emptySearch: {
    padding: 24,
    alignItems: "center",
  },
  emptySearchIcon: {
    fontSize: 32,
    marginBottom: 8,
    opacity: 0.5,
  },
  emptySearchText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 4,
  },
  emptySearchHint: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
  readyNotice: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#10B981",
    borderRadius: 8,
    padding: 16,
  },
  readyNoticeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#065F46",
    marginBottom: 4,
  },
  readyNoticeText: {
    fontSize: 14,
    color: "#047857",
  },
  hardwareNotice: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: 8,
    padding: 16,
  },
  hardwareNoticeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 4,
  },
  hardwareNoticeText: {
    fontSize: 14,
    color: "#B45309",
  },
  inputSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
  },
  toggleLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginRight: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  trackingInput: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#1F2937",
  },
  trackingInputDisabled: {
    backgroundColor: "#F3F4F6",
    color: "#9CA3AF",
  },
  submitButton: {
    backgroundColor: "#10B981",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 8,
  },
  submitButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  historySection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyCount: {
    fontSize: 14,
    color: "#6B7280",
  },
  historyCard: {
    backgroundColor: "#ECFDF5",
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  statusText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1F2937",
  },
  emptyHistory: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyHistoryIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyHistoryText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 8,
  },
  emptyHistorySubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
  historyScroll: {
    maxHeight: 300,
  },
  historyItem: {
    flexDirection: "row",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  historyItemLatest: {
    backgroundColor: "#ECFDF5",
  },
  historyLeft: {
    alignItems: "center",
    marginRight: 12,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  historyIconLatest: {
    backgroundColor: "#10B981",
  },
  historyIconText: {
    fontSize: 16,
  },
  historyNumber: {
    backgroundColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  historyNumberText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
  },
  historyContent: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  historyCode: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historyBadgeAuto: {
    backgroundColor: "#DCFCE7",
  },
  historyBadgeManual: {
    backgroundColor: "#FEF3C7",
  },
  historyBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#065F46",
  },
  historyDetails: {
    gap: 2,
  },
  historyCustomer: {
    fontSize: 14,
    color: "#6B7280",
  },
  historyTime: {
    fontSize: 14,
    color: "#6B7280",
  },
});
