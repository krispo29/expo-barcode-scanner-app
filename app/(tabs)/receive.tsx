import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Audio as ExpoAudio } from "expo-av";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
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

type Customer = {
  uuid: string;
  code: string;
  companyCode: string;
  email: string;
  name: string;
  tel: string;
  discountPointRate: number;
  createdAt: string;
  totalOrder: number;
};

type ScanRecord = {
  id: string;
  customerId: string;
  customerCode: string;
  code: string;
  scannedAt: string;
  mode: "auto" | "manual";
};

type ApiResponse<T = any> = {
  code: number;
  message?: string;
  data: T;
};

export default function ReceiveScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Customer Selection
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Check if ready to scan
  const canScan = customer !== null;

  // Dropdown states
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Search states
  const [customerSearch, setCustomerSearch] = useState("");

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
    };
  }, []);

  // Load customers เมื่อเข้าหน้า
  useEffect(() => {
    loadCustomers();
  }, []);

  // Auto-focus tracking input when customer is selected and dropdown is closed
  useEffect(() => {
    if (customer && !showCustomerDropdown && inputRef.current) {
      // Small timeout to ensure UI is ready
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [customer, showCustomerDropdown]);

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      const endpoint = `${apiUrl}/v1/customers/inbound`;

      // ดึง access token จาก storage
      const token = await AsyncStorage.getItem("access_token");

      if (!token) {
        Alert.alert("ไม่พบ Token", "กรุณา login ใหม่อีกครั้ง");
        return;
      }

      const response = await axios.get<ApiResponse<Customer[]>>(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("=== Load Customers Response ===");
      console.log("Endpoint:", endpoint);
      console.log("Response:", response.data);

      if (response.data && response.data.code === 200) {
        setCustomers(response.data.data);
      } else {
        Alert.alert(
          "ไม่สามารถโหลดข้อมูลลูกค้าได้",
          response.data.message || "กรุณาลองใหม่อีกครั้ง",
        );
      }
    } catch (error: any) {
      console.error("Load customers error:", error);
      if (error?.response?.status === 401) {
        Alert.alert("ไม่ได้รับอนุญาต", "กรุณา login ใหม่อีกครั้ง");
      } else {
        Alert.alert(
          "ไม่สามารถโหลดข้อมูลลูกค้าได้",
          "เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง",
        );
      }
    } finally {
      setLoadingCustomers(false);
    }
  };

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
              await AsyncStorage.removeItem("access_token");
              await AsyncStorage.removeItem("user_data");

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

  const handleDetected = useCallback(
    async (rawValue: string, mode: "auto" | "manual") => {
      // Check if customer is selected
      if (!canScan || !customer) {
        Alert.alert("กรุณาเลือกลูกค้า", "กรุณาเลือกลูกค้าก่อนสแกน");
        return;
      }

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

      // ป้องกันการยิงซ้ำติดกัน
      if (lastValue === normalized && now - lastTimestamp < 1500) {
        return;
      }

      if (scannedLock) return;
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
        console.log("Customer Code:", customer.code);

        const apiUrl = process.env.EXPO_PUBLIC_API_URL;
        const endpoint = `${apiUrl}/v1/orders/received_inbound/${normalized}`;

        // ดึง access token จาก storage
        const token = await AsyncStorage.getItem("access_token");

        if (!token) {
          Alert.alert("ไม่พบ Token", "กรุณา login ใหม่อีกครั้ง");
          return;
        }

        console.log("Endpoint:", endpoint);

        const response = await axios.get<ApiResponse>(endpoint, {
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
            customerId: customer.uuid,
            customerCode: customer.code,
            code: normalized,
            scannedAt: new Date().toISOString(),
            mode,
          };

          setHistory((prev) => [record, ...prev].slice(0, 30));
          setLastStatus(
            `${normalized} • ${customer.name} • ${shippingType.toUpperCase()}`,
          );
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
        unlockTimer.current = setTimeout(() => setScannedLock(false), 900);
      }
    },
    [canScan, customer, scannedLock],
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

  // Filter customers
  const filteredCustomers = customers.filter(
    (item) =>
      item.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      item.code.toLowerCase().includes(customerSearch.toLowerCase()) ||
      item.email.toLowerCase().includes(customerSearch.toLowerCase()),
  );

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

      {/* Compact Header - App Title Only */}
      <View style={styles.compactHeader}>
        <View style={styles.compactHeaderContent}>
          <Text style={styles.compactHeaderTitle}>SHIP2CU Receive</Text>
          <Text style={styles.compactHeaderSubtitle}>
            สแกนบาร์โค้ดเพื่อรับเข้า (Receive)
          </Text>
        </View>
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
          {/* Customer Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. เลือกลูกค้า</Text>
            <View>
              <TouchableOpacity
                style={[
                  styles.selectButton,
                  showCustomerDropdown && styles.selectButtonActive,
                ]}
                onPress={() => {
                  setShowCustomerDropdown(!showCustomerDropdown);
                }}
                disabled={loadingCustomers}
              >
                <View style={styles.selectButtonContent}>
                  <Text style={styles.selectButtonLabel}>
                    {(() => {
                      if (loadingCustomers) return "กำลังโหลดข้อมูลลูกค้า...";
                      if (customer)
                        return `${customer.code} - ${customer.name}`;
                      return "กดเพื่อเลือกลูกค้า";
                    })()}
                  </Text>
                  {customer && (
                    <Text style={styles.selectButtonDescription}>
                      📧 {customer.email} | 📞 {customer.tel}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.selectButtonIcon,
                    showCustomerDropdown && styles.selectButtonIconActive,
                  ]}
                >
                  {showCustomerDropdown ? "▲" : "▼"}
                </Text>
              </TouchableOpacity>

              {showCustomerDropdown && (
                <View style={styles.dropdown}>
                  <View style={styles.searchContainer}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                      value={customerSearch}
                      onChangeText={setCustomerSearch}
                      placeholder="ค้นหาด้วยรหัส, ชื่อ หรืออีเมล..."
                      style={styles.searchInput}
                      placeholderTextColor="#9CA3AF"
                      autoFocus={true}
                    />
                    {customerSearch.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setCustomerSearch("")}
                        style={styles.searchClear}
                      >
                        <Text style={styles.searchClearText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.dropdownHeader}>
                    <Text style={styles.dropdownHeaderText}>
                      {customerSearch.length > 0
                        ? `พบ ${filteredCustomers.length} รายการ`
                        : `ทั้งหมด ${customers.length} รายการ`}
                    </Text>
                    {customerSearch.length > 0 &&
                      filteredCustomers.length > 10 && (
                        <Text style={styles.dropdownHeaderHint}>
                          แสดง 10 รายการแรก
                        </Text>
                      )}
                  </View>

                  <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                    {filteredCustomers.length === 0 ? (
                      <View style={styles.emptySearch}>
                        <Text style={styles.emptySearchIcon}>🔍</Text>
                        <Text style={styles.emptySearchText}>
                          ไม่พบข้อมูลลูกค้า
                        </Text>
                        <Text style={styles.emptySearchHint}>
                          ลองค้นหาด้วยรหัสลูกค้า ชื่อ หรืออีเมล
                        </Text>
                      </View>
                    ) : (
                      filteredCustomers.slice(0, 10).map((item, index) => (
                        <TouchableOpacity
                          key={`customer-${item.uuid}-${index}`}
                          style={[
                            styles.dropdownItem,
                            customer?.uuid === item.uuid &&
                              styles.dropdownItemActive,
                          ]}
                          onPress={() => {
                            setCustomer(item);
                            setShowCustomerDropdown(false);
                            setCustomerSearch("");
                          }}
                        >
                          <View style={styles.dropdownItemContent}>
                            <Text style={styles.dropdownItemTitle}>
                              {item.code} - {item.name}
                            </Text>
                            <Text style={styles.dropdownItemDescription}>
                              📧 {item.email} | 📞 {item.tel} | 📦{" "}
                              {item.totalOrder} orders
                            </Text>
                          </View>
                          {customer?.uuid === item.uuid && (
                            <Text style={styles.dropdownItemCheck}>✓</Text>
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>

          {/* Ready to Scan Notice */}
          {canScan ? (
            <View style={[styles.section, styles.readyNotice]}>
              <Text style={styles.readyNoticeTitle}>✅ พร้อมสแกนบาร์โค้ด</Text>
              <Text style={styles.readyNoticeText}>
                คุณได้เลือกลูกค้าแล้ว สามารถเริ่มสแกนบาร์โค้ดได้
              </Text>
            </View>
          ) : (
            <View style={[styles.section, styles.hardwareNotice]}>
              <Text style={styles.hardwareNoticeTitle}>
                ⚠️ กรุณาเลือกลูกค้าก่อนสแกน
              </Text>
              <Text style={styles.hardwareNoticeText}>
                กรุณาเลือกลูกค้าก่อนที่จะสามารถสแกนบาร์โค้ดได้
              </Text>
            </View>
          )}

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
                  ref={inputRef}
                  value={input}
                  onChangeText={handleInputChange}
                  placeholder={
                    canScan
                      ? "กรอกหรือสแกน Tracking No."
                      : "เลือกลูกค้าก่อนสแกน"
                  }
                  style={[
                    styles.trackingInput,
                    !canScan && styles.trackingInputDisabled,
                  ]}
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
                          <Text style={styles.historyCustomer}>
                            👤 {item.customerCode}
                          </Text>
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

          {/* Logout Section - At Bottom */}
          <View style={styles.logoutSection}>
            <TouchableOpacity
              style={styles.bottomLogoutButton}
              onPress={handleLogout}
              delayPressIn={200}
              activeOpacity={0.8}
            >
              <Text style={styles.bottomLogoutButtonText}>🚪 ออกจากระบบ</Text>
              <Text style={styles.bottomLogoutButtonHint}>
                (กดเพื่อออกจากระบบ)
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1F2937",
  },
  compactHeader: {
    backgroundColor: "#374151",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#4B5563",
  },
  compactHeaderContent: {
    alignItems: "center",
  },
  compactHeaderTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
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
    backgroundColor: "#3B82F6",
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
  statusCard: {
    backgroundColor: "#EFF6FF",
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
    backgroundColor: "#EFF6FF",
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
    backgroundColor: "#3B82F6",
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
  logoutSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  bottomLogoutButton: {
    backgroundColor: "#EF4444",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bottomLogoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  bottomLogoutButtonHint: {
    fontSize: 12,
    color: "#FECACA",
    opacity: 0.8,
  },
});
