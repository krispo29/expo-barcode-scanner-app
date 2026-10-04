import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio as ExpoAudio } from "expo-av";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  classifyScanError,
  getScanErrorMessage,
  ScanErrorKind,
  ScanErrorModal,
} from "../components/ScanErrorModal";
import {
  GlanceableHeroBanner,
  GlanceableHeroBannerProps,
} from "../components/GlanceableHeroBanner";
import { TrackingCodeText } from "../components/TrackingCodeText";
import { QuickChips, QuickChipItem } from "../components/QuickChips";
import {
  ThumbSelectionModal,
  ThumbModalItem,
} from "../components/ThumbSelectionModal";
import { updateRecentIds } from "../../utils/recentSelections";
import { clearStoredAuth, getValidAccessToken } from "../../utils/auth";
import api from "../../utils/api";
import { getScannerTestOutcome, isScannerTestMode } from "../../utils/scannerTestMode";
import {
  triggerErrorHaptic,
  triggerSuccessHaptic,
} from "../../utils/haptics";

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
  code: number | string;
  message?: string;
  data: T;
};

const SCANNER_AUTO_SUBMIT_DELAY_MS = 150;
const BEEP_GAP_MS = 160;
const TEST_CUSTOMER: Customer = {
  uuid: "scanner-test-customer",
  code: "TEST",
  companyCode: "",
  email: "",
  name: "TEST CUSTOMER",
  tel: "",
  discountPointRate: 0,
  createdAt: "",
  totalOrder: 0,
};

export default function ReleaseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const ensureAuthenticated = useCallback(async () => {
    if (isScannerTestMode) return "scanner-test";

    const token = await getValidAccessToken();
    if (!token) {
      router.replace("/login");
      return null;
    }

    return token;
  }, [router]);

  // Customer Selection
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [recentCustomerUuids, setRecentCustomerUuids] = useState<string[]>([]);

  // QoL States (Keyboard suppression & Hero Banner)
  const [showSoftKeyboard, setShowSoftKeyboard] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [heroBanner, setHeroBanner] = useState<GlanceableHeroBannerProps | null>(null);

  // Check if ready to scan
  const canScan = customer !== null;

  const [autoEnter, setAutoEnter] = useState(true);
  const [input, setInput] = useState("");
  const [scannedLock, setScannedLock] = useState(false);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [lastStatus, setLastStatus] = useState<string>("-");
  const [scanError, setScanError] = useState<ScanErrorKind | null>(null);

  // Sound objects for Release: success, beep
  const [soundSuccess, setSoundSuccess] = useState<ExpoAudio.Sound>();
  const [soundBeep, setSoundBeep] = useState<ExpoAudio.Sound>();

  // Load sounds
  useEffect(() => {
    async function loadSounds() {
      try {
        const { sound: s1 } = await ExpoAudio.Sound.createAsync(
          require("../../assets/sounds/success.mp3"),
        );
        setSoundSuccess(s1);

        const { sound: s2 } = await ExpoAudio.Sound.createAsync(
          require("../../assets/sounds/beep.mp3"),
        );
        setSoundBeep(s2);
      } catch (error) {
        console.log("Error loading sounds", error);
      }
    }

    void loadSounds();

    return () => {
      soundSuccess?.unloadAsync();
      soundBeep?.unloadAsync();
    };
  }, []);

  const autoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idCounter = useRef(0);
  const lastScanRef = useRef({ value: "", timestamp: 0 });
  const scannedCodesRef = useRef(new Set<string>());
  const latestInputRef = useRef("");
  const scanInFlightRef = useRef(false);

  const inputRef = useRef<TextInput | null>(null);

  const clearAutoSubmitTimer = useCallback(() => {
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
  }, []);

  const focusTrackingInput = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
  }, []);

  // โฟกัสช่อง Tracking Number อัตโนมัติเมื่อเข้า screen
  useEffect(() => {
    if (inputRef.current) {
      focusTrackingInput();
    }
  }, [focusTrackingInput]);

  // เคลียร์ timer ตอน unmount
  useEffect(() => {
    return () => {
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isScannerTestMode) void ensureAuthenticated();
  }, [ensureAuthenticated]);

  useEffect(() => {
    if (isScannerTestMode) {
      setCustomer(TEST_CUSTOMER);
      setHeroBanner({
        statusType: "idle",
        title: `พร้อมสแกน: ${TEST_CUSTOMER.name}`,
        subtitle: "โหมดทดสอบ — สามารถยิงบาร์โค้ดได้ทันที",
        badgeLabel: TEST_CUSTOMER.code,
        badgeType: "default",
      });
    }
  }, []);

  // Auto-focus tracking input when customer is selected and modal is closed
  useEffect(() => {
    if (customer && !showCustomerModal && inputRef.current) {
      focusTrackingInput();
    }
  }, [customer, focusTrackingInput, showCustomerModal]);

  const showScanError = useCallback((kind: ScanErrorKind) => {
    clearAutoSubmitTimer();
    latestInputRef.current = "";
    setInput("");
    inputRef.current?.blur();
    setScanError(kind);
  }, [clearAutoSubmitTimer]);

  const confirmScanError = useCallback(() => {
    setScanError(null);
    focusTrackingInput();
  }, [focusTrackingInput]);

  const playBeepPattern = useCallback(
    async (count: number) => {
      if (!soundBeep) return;

      for (let index = 0; index < count; index += 1) {
        await soundBeep.replayAsync();
        if (index < count - 1) {
          await new Promise((resolve) => setTimeout(resolve, BEEP_GAP_MS));
        }
      }
    },
    [soundBeep],
  );

  const playErrorSound = useCallback(
    async (kind: ScanErrorKind) => {
      const beepCount =
        kind === "destinationMismatch"
          ? 4
          : kind === "notFound"
            ? 3
            : kind === "wrongCustomer"
              ? 2
              : 1;
      await playBeepPattern(beepCount);
    },
    [playBeepPattern],
  );

  const handleSelectCustomer = useCallback(
    (item: Customer) => {
      setCustomer(item);
      setShowCustomerModal(false);
      void AsyncStorage.setItem("@selected_customer_uuid", item.uuid);
      setRecentCustomerUuids((prev) => {
        const next = updateRecentIds(prev, item.uuid, 4);
        void AsyncStorage.setItem("@recent_customers", JSON.stringify(next));
        return next;
      });
      triggerSuccessHaptic();
      setHeroBanner({
        statusType: "idle",
        title: `เลือกลูกค้า: ${item.code}`,
        subtitle: `${item.name} • พร้อมยิงปล่อยออก`,
        badgeLabel: item.code,
        badgeType: "default",
      });
      focusTrackingInput();
    },
    [focusTrackingInput],
  );

  const loadCustomers = useCallback(async () => {
    if (isScannerTestMode) {
      setCustomer(TEST_CUSTOMER);
      setRecentCustomerUuids([TEST_CUSTOMER.uuid]);
      return;
    }

    setLoadingCustomers(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      const endpoint = `${apiUrl}/v1/customers/inbound`;

      const token = await ensureAuthenticated();
      if (!token) {
        return;
      }

      const response = await api.get<ApiResponse<Customer[]>>(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (
        response.data &&
        response.data.code === 200 &&
        Array.isArray(response.data.data)
      ) {
        const fetchedCustomers = response.data.data;
        setCustomers(fetchedCustomers);

        // Restore saved selected customer
        const savedCustomerUuid = await AsyncStorage.getItem(
          "@selected_customer_uuid",
        );
        if (savedCustomerUuid) {
          const matched = fetchedCustomers.find(
            (c) => c.uuid === savedCustomerUuid,
          );
          if (matched) setCustomer(matched);
        }

        // Restore recent customer uuids
        const savedRecents = await AsyncStorage.getItem("@recent_customers");
        if (savedRecents) {
          try {
            setRecentCustomerUuids(JSON.parse(savedRecents));
          } catch (e) {
            console.error("Error parsing recent customers:", e);
          }
        }
      } else {
        console.error("Failed to load customers:", response.data?.message);
      }
    } catch (error) {
      console.error("Error loading customers:", error);
    } finally {
      setLoadingCustomers(false);
    }
  }, [ensureAuthenticated]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  useFocusEffect(
    useCallback(() => {
      if (!isScannerTestMode) {
        void ensureAuthenticated();
        void loadCustomers();
      }
    }, [ensureAuthenticated, loadCustomers]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        if (!isScannerTestMode) void ensureAuthenticated();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [ensureAuthenticated]);

  const handleLogout = async () => {
    if (Date.now() - lastScanRef.current.timestamp < 1000) {
      console.log("Logout blocked - recent scan detected");
      return;
    }

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
              await clearStoredAuth();
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
      clearAutoSubmitTimer();

      // Check if customer is selected
      if (!canScan || !customer) {
        setLastStatus("กรุณาเลือกลูกค้าก่อนสแกน");
        setHeroBanner({
          statusType: "error",
          title: "ยังไม่ได้เลือกลูกค้า",
          badgeLabel: "NO CUSTOMER",
          badgeType: "error",
          subtitle: "กรุณาเลือกลูกค้าด้านบนก่อนเริ่มสแกน",
        });
        showScanError("wrongCustomer");
        triggerErrorHaptic();
        await playErrorSound("wrongCustomer");
        return;
      }

      const normalized = normalizeTracking(rawValue);
      if (!normalized) {
        setLastStatus("ไม่พบ Tracking No.");
        showScanError("notFound");
        triggerErrorHaptic();
        await playErrorSound("notFound");
        return;
      }

      const isDuplicate = scannedCodesRef.current.has(normalized);
      if (isDuplicate) {
        setLastStatus(`${normalized} • ยิงออกซ้ำในเครื่องนี้`);
        setHeroBanner({
          statusType: "error",
          title: "ยิงออกซ้ำแล้ว!",
          trackingCode: normalized,
          badgeLabel: "DUPLICATE",
          badgeType: "error",
          subtitle: "รายการนี้ถูกยิงปล่อยออกไปแล้ว",
        });
        showScanError("duplicate");
        triggerErrorHaptic();
        await playErrorSound("duplicate");
        return;
      }

      if (scanInFlightRef.current) return;
      scanInFlightRef.current = true;
      setScannedLock(true);
      lastScanRef.current = { value: normalized, timestamp: Date.now() };
      let modalOpened = false;

      try {
        if (isScannerTestMode) {
          const outcome = getScannerTestOutcome(normalized);
          if (outcome !== "success") {
            const errorKind = outcome === "invalid" ? "generic" : "system";
            setLastStatus(`${normalized} • ${getScanErrorMessage(errorKind)}`);
            setHeroBanner({
              statusType: "error",
              title: getScanErrorMessage(errorKind),
              trackingCode: normalized,
              badgeLabel: errorKind.toUpperCase(),
              badgeType: "error",
              subtitle: "กรุณากดยืนยันเพื่อดำเนินการต่อ",
            });
            modalOpened = true;
            showScanError(errorKind);
            triggerErrorHaptic();
            void playErrorSound(errorKind);
            return;
          }

          idCounter.current += 1;
          const record: ScanRecord = {
            id: `${Date.now()}-${idCounter.current}`,
            customerId: customer.uuid,
            customerCode: customer.code,
            code: normalized,
            scannedAt: new Date().toISOString(),
            mode,
          };
          scannedCodesRef.current.add(normalized);
          latestInputRef.current = "";
          setHistory((prev) => [record, ...prev].slice(0, 30));
          setLastStatus(`${normalized} • ${customer.name}`);
          setHeroBanner({
            statusType: "success",
            title: "ปล่อยออกสำเร็จ",
            trackingCode: normalized,
            badgeLabel: customer.code,
            badgeType: "success",
            subtitle: `${customer.name} • ${new Date().toLocaleTimeString("th-TH")}`,
          });
          triggerSuccessHaptic();
          setInput("");
          if (soundSuccess) await soundSuccess.replayAsync();
          return;
        }

        console.log("=== Scan Request ===");
        console.log("Tracking No:", normalized);
        console.log("Customer Code:", customer.code);

        const apiUrl = process.env.EXPO_PUBLIC_API_URL;
        const endpoint = `${apiUrl}/v1/orders/released/${normalized}?customer_code=${customer.code}&device=mobile`;

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
          idCounter.current += 1;
          const record: ScanRecord = {
            id: `${Date.now()}-${idCounter.current}`,
            customerId: customer.uuid,
            customerCode: customer.code,
            code: normalized,
            scannedAt: new Date().toISOString(),
            mode,
          };

          scannedCodesRef.current.add(normalized);
          latestInputRef.current = "";
          setHistory((prev) => [record, ...prev].slice(0, 30));
          setLastStatus(`${normalized} • ${customer.name}`);
          setHeroBanner({
            statusType: "success",
            title: "ปล่อยออกสำเร็จ",
            trackingCode: normalized,
            badgeLabel: customer.code,
            badgeType: "success",
            subtitle: `${customer.name} • ${new Date().toLocaleTimeString("th-TH")}`,
          });
          triggerSuccessHaptic();
          setInput("");

          if (soundSuccess) {
            try {
              await soundSuccess.replayAsync();
            } catch (err) {
              console.log("Error playing success sound", err);
            }
          }
        } else {
          const errorKind = classifyScanError(
            response.data?.message,
            response.data?.code,
          );
          setLastStatus(`${normalized} • ${getScanErrorMessage(errorKind)}`);
          setHeroBanner({
            statusType: "error",
            title: getScanErrorMessage(errorKind),
            trackingCode: normalized,
            badgeLabel: errorKind.toUpperCase(),
            badgeType: "error",
            subtitle: errorKind === "wrongCustomer" ? "ลูกค้าไม่ตรงกับที่เลือกไว้" : "กรุณากดยืนยันเพื่อดำเนินการต่อ",
          });
          modalOpened = true;
          showScanError(errorKind);
          triggerErrorHaptic();
          void playErrorSound(errorKind);
        }
      } catch (error: any) {
        console.error("Scan error:", error);
        let errorMessage = "เกิดข้อผิดพลาดในการตรวจสอบ Tracking Number";
        const errorCode = error?.response?.data?.code;
        if (error?.response?.data?.message) {
          errorMessage = error.response.data.message;
        }

        const status = Number(error?.response?.status);
        const systemFailure =
          !error?.response || status === 401 || status === 403 || status >= 500;
        const errorKind = classifyScanError(
          errorMessage,
          errorCode,
          systemFailure,
        );
        setLastStatus(`${normalized} • ${getScanErrorMessage(errorKind)}`);
        setHeroBanner({
          statusType: "error",
          title: getScanErrorMessage(errorKind),
          trackingCode: normalized,
          badgeLabel: "ERROR",
          badgeType: "error",
          subtitle: errorMessage,
        });
        modalOpened = true;
        showScanError(errorKind);
        triggerErrorHaptic();
        void playErrorSound(errorKind);
      } finally {
        scanInFlightRef.current = false;
        setScannedLock(false);
        if (!modalOpened) focusTrackingInput();
      }
    },
    [
      canScan,
      clearAutoSubmitTimer,
      customer,
      ensureAuthenticated,
      focusTrackingInput,
      playErrorSound,
      showScanError,
      soundSuccess,
    ],
  );

  // ใช้กับสแกนเนอร์ฮาร์ดแวร์ (RS51 ยิงแล้วส่งตัวอักษร + Enter เข้ามา)
  const handleInputChange = useCallback(
    (text: string) => {
      if (scanInFlightRef.current || scanError !== null) return;

      const sanitized = text.replaceAll(/[\r\n]/g, "");
      const hasSubmitChar = /[\r\n]/.test(text);
      latestInputRef.current = sanitized;
      setInput(sanitized);
      clearAutoSubmitTimer();

      if (!autoEnter || !sanitized.trim()) return;
      if (hasSubmitChar) {
        void handleDetected(sanitized, "auto");
        return;
      }

      autoSubmitTimerRef.current = setTimeout(() => {
        const latestValue = latestInputRef.current.trim();
        if (latestValue === sanitized.trim()) {
          void handleDetected(latestValue, "auto");
        }
      }, SCANNER_AUTO_SUBMIT_DELAY_MS);
    },
    [autoEnter, clearAutoSubmitTimer, handleDetected, scanError],
  );

  const handleManualSubmit = () => {
    const trackingNumber = latestInputRef.current;
    if (!trackingNumber.trim() || !canScan) return;
    clearAutoSubmitTimer();
    void handleDetected(trackingNumber, autoEnter ? "auto" : "manual");
  };

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.tel.includes(q),
    );
  }, [customers, customerSearch]);

  const modalCustomerItems: ThumbModalItem[] = useMemo(() => {
    return filteredCustomers.map((item) => ({
      id: item.uuid,
      title: `${item.code} - ${item.name}`,
      subtitle: `📧 ${item.email || "-"} | 📞 ${item.tel || "-"} | 📦 ${item.totalOrder || 0} orders`,
      badge: {
        text: `${item.totalOrder || 0} PKGS`,
        variant: "blue",
      },
      selected: customer?.uuid === item.uuid,
    }));
  }, [customer, filteredCustomers]);

  const quickCustomerChips: QuickChipItem[] = useMemo(() => {
    if (customers.length === 0) return [];
    const chips: Customer[] = [];

    for (const uuid of recentCustomerUuids) {
      const found = customers.find((c) => c.uuid === uuid);
      if (found && !chips.some((c) => c.uuid === found.uuid)) {
        chips.push(found);
      }
    }
    for (const c of customers) {
      if (chips.length >= 4) break;
      if (!chips.some((item) => item.uuid === c.uuid)) {
        chips.push(c);
      }
    }

    return chips.map((c) => ({
      id: c.uuid,
      label: c.code,
      subLabel: c.name,
      icon: "👤",
      badge: `${c.totalOrder || 0} pkgs`,
      active: customer?.uuid === c.uuid,
    }));
  }, [customer, customers, recentCustomerUuids]);

  return (
    <TouchableWithoutFeedback onPress={focusTrackingInput} accessible={false}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScanErrorModal kind={scanError} onConfirm={confirmScanError} />

        {/* Thumb-friendly Customer Selection Modal */}
        <ThumbSelectionModal
          visible={showCustomerModal}
          title="เลือกลูกค้า (Select Customer)"
          subtitle="แตะเลือกลูกค้าสำหรับปล่อยพัสดุออก"
          items={modalCustomerItems}
          searchPlaceholder="ค้นหาด้วยชื่อ, รหัส, อีเมล หรือเบอร์..."
          searchValue={customerSearch}
          onSearchChange={setCustomerSearch}
          onSelectItem={(item) => {
            const target = customers.find((c) => c.uuid === item.id);
            if (target) handleSelectCustomer(target);
          }}
          onClose={() => {
            setShowCustomerModal(false);
            focusTrackingInput();
          }}
          loading={loadingCustomers}
        />

        {isScannerTestMode && (
          <View style={styles.testModeBanner}>
            <Text style={styles.testModeBannerText}>โหมดทดสอบ — ไม่มีการบันทึกข้อมูล</Text>
          </View>
        )}

        {/* Invisible Dummy Button - To catch scanner triggers */}
        <TouchableOpacity
          style={styles.dummyButton}
          onPress={() => {
            console.log("Dummy button triggered - ignoring");
          }}
          activeOpacity={1}
        >
          <View style={styles.dummyButtonContent} />
        </TouchableOpacity>

        {/* Compact Header - App Title + Logout */}
        <View style={styles.compactHeader}>
          <View style={styles.compactHeaderContent}>
            <Text style={styles.compactHeaderTitle}>📤 SHIP2CU Release</Text>
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
            {/* Customer Selection with Thumb Ergonomics & Quick Chips */}
            {!isScannerTestMode && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>1. เลือกลูกค้า*</Text>
                <View style={styles.customerHeaderRow}>
                  <TouchableOpacity
                    style={[
                      styles.selectButton,
                      showCustomerModal && styles.selectButtonActive,
                      { flex: 1, marginRight: 8 },
                    ]}
                    onPress={() => setShowCustomerModal(true)}
                    disabled={loadingCustomers}
                    activeOpacity={0.8}
                  >
                    <View style={styles.selectButtonContent}>
                      <Text style={styles.selectButtonLabel}>
                        {(() => {
                          if (loadingCustomers)
                            return "กำลังโหลดข้อมูลลูกค้า...";
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
                    <Text style={styles.selectButtonIcon}>▼</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.reloadButton}
                    onPress={loadCustomers}
                    disabled={loadingCustomers}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.reloadButtonText}>🔄</Text>
                  </TouchableOpacity>
                </View>

                {/* Quick Customer Chips (Thumb Reach Zone) */}
                <QuickChips
                  title="⚡ สลับลูกค้าด่วน (1-Tap):"
                  items={quickCustomerChips}
                  onSelect={(chip) => {
                    const target = customers.find((c) => c.uuid === chip.id);
                    if (target) handleSelectCustomer(target);
                  }}
                />
              </View>
            )}

            {/* QoL Hero Banner - Large Glanceable Scan Feedback */}
            {heroBanner && (
              <GlanceableHeroBanner
                statusType={heroBanner.statusType}
                title={heroBanner.title}
                trackingCode={heroBanner.trackingCode}
                subtitle={heroBanner.subtitle}
                badgeLabel={heroBanner.badgeLabel}
                badgeType={heroBanner.badgeType}
                actionText={heroBanner.actionText}
                onActionPress={heroBanner.onActionPress}
              />
            )}

            {/* Ready to Scan Notice */}
            {!heroBanner && (
              canScan ? (
                <View style={[styles.section, styles.readyNotice]}>
                  <Text style={styles.readyNoticeTitle}>✅ พร้อมสแกนบาร์โค้ด</Text>
                  <Text style={styles.readyNoticeText}>
                    ลูกค้า: {customer?.name} ({customer?.code})
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
              )
            )}

            {/* Manual Input & Settings with Focus Shield & Soft Keyboard Suppression */}
            <View style={styles.section}>
              <View style={styles.inputSection}>
                <View style={styles.inputHeader}>
                  <Text style={styles.sectionTitle}>Tracking Number</Text>
                  <View style={styles.autoToggle}>
                    <Text style={styles.toggleLabel}>Auto</Text>
                    <Switch
                      value={autoEnter}
                      onValueChange={setAutoEnter}
                      trackColor={{
                        false: "#E5E7EB",
                        true: "rgba(252, 211, 77, 1.00)",
                      }}
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
                      isInputFocused && styles.trackingInputFocused,
                      !canScan && styles.trackingInputDisabled,
                    ]}
                    keyboardType="default"
                    returnKeyType="done"
                    placeholderTextColor="#9CA3AF"
                    autoCorrect={false}
                    showSoftInputOnFocus={showSoftKeyboard}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    editable={canScan && !scannedLock && scanError === null}
                    submitBehavior="submit"
                    onSubmitEditing={autoEnter ? handleManualSubmit : undefined}
                  />

                  {/* QoL Keyboard Toggle Button */}
                  <TouchableOpacity
                    style={[
                      styles.keyboardToggleBtn,
                      showSoftKeyboard && styles.keyboardToggleBtnActive,
                    ]}
                    onPress={() => {
                      const nextState = !showSoftKeyboard;
                      setShowSoftKeyboard(nextState);
                      setTimeout(() => inputRef.current?.focus(), 100);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.keyboardToggleIcon}>
                      {showSoftKeyboard ? "⌨️ ON" : "⌨️"}
                    </Text>
                  </TouchableOpacity>

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

            {/* Status & History with Monospace Digits Highlight */}
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
                <ScrollView
                  style={styles.historyScroll}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  {history.map((item, index) => {
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
                            <TrackingCodeText
                              code={item.code}
                              style={styles.historyCode}
                              highlightStyle={styles.historyCodeHighlight}
                            />
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
          </ScrollView>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
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
    backgroundColor: "#1F2937",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
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
    color: "rgba(252, 211, 77, 1.00)",
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
  testModeBanner: {
    alignItems: "center",
    padding: 10,
    backgroundColor: "#B91C1C",
  },
  testModeBannerText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 10,
  },
  customerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
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
    borderColor: "rgba(252, 211, 77, 1.00)",
    backgroundColor: "#FFFBEB",
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
  reloadButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  reloadButtonText: {
    fontSize: 20,
  },
  selectButtonIconActive: {
    color: "rgba(252, 211, 77, 1.00)",
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
    backgroundColor: "#FFFBEB",
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
    color: "rgba(252, 211, 77, 1.00)",
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
    padding: 14,
    marginBottom: 16,
  },
  readyNoticeTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#065F46",
    marginBottom: 2,
  },
  readyNoticeText: {
    fontSize: 13,
    color: "#047857",
  },
  hardwareNotice: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  hardwareNoticeTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 2,
  },
  hardwareNoticeText: {
    fontSize: 13,
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
    marginBottom: 10,
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
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#1F2937",
  },
  trackingInputFocused: {
    borderColor: "rgba(252, 211, 77, 1.00)",
    borderWidth: 2,
    backgroundColor: "#FFFFFF",
    shadowColor: "rgba(252, 211, 77, 1.00)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  trackingInputDisabled: {
    backgroundColor: "#F3F4F6",
    color: "#9CA3AF",
  },
  keyboardToggleBtn: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 11,
    marginLeft: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  keyboardToggleBtnActive: {
    backgroundColor: "#FFFBEB",
    borderColor: "rgba(252, 211, 77, 1.00)",
  },
  keyboardToggleIcon: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  submitButton: {
    backgroundColor: "rgba(252, 211, 77, 1.00)",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
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
    backgroundColor: "rgba(252, 211, 77, 1.00)",
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
  historyCodeHighlight: {
    fontSize: 16,
    fontWeight: "800",
    color: "#D97706",
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
