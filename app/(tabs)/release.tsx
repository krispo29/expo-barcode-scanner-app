import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio as ExpoAudio } from "expo-av";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Alert,
  FlatList,
  Image,
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
import { OfflineSyncBanner } from "../components/OfflineSyncBanner";
import {
  addToOfflineQueue,
  getOfflineQueue,
  isTrackingInQueue,
  OFFLINE_STORAGE_KEYS,
  ReleaseQueueItem,
  removeFromOfflineQueue,
} from "../../utils/offlineQueue";
import { updateRecentIds } from "../../utils/recentSelections";
import { clearStoredAuth, getValidAccessToken } from "../../utils/auth";
import api from "../../utils/api";
import { getScannerTestOutcome, isScannerTestMode } from "../../utils/scannerTestMode";
import {
  triggerErrorHaptic,
  triggerSuccessHaptic,
  triggerWarningHaptic,
} from "../../utils/haptics";
import { ProductivityMetricsBar } from "../components/ProductivityMetricsBar";
import { NetworkStatusBadge } from "../components/NetworkStatusBadge";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useHardwareScanner } from "../../hooks/useHardwareScanner";
import {
  appendScanRecord,
  clearScanHistory,
  getReleaseHistoryKey,
  loadScanHistory,
} from "../../utils/scanHistory";
import {
  calculateScanVelocity,
  getInitialShiftMetrics,
  getSoundSettings,
  loadShiftMetrics,
  METRICS_STORAGE_KEYS,
  recordScanMetric,
  resetShiftMetrics,
  ShiftMetrics,
} from "../../utils/productivityMetrics";
import { industrialAudio } from "../../utils/industrialAudio";

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

// Memoized Scan History Row: eliminates 90%+ re-renders across existing items when new scans arrive
const ReleaseHistoryRow = React.memo(function ReleaseHistoryRow({
  item,
  scanNumber,
  isLatest,
}: {
  item: ScanRecord;
  scanNumber: number;
  isLatest: boolean;
}) {
  const scanTime = new Date(item.scannedAt);

  return (
    <View
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
          <Text style={styles.historyNumberText}>#{scanNumber}</Text>
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
});

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

  const { isOnline } = useNetworkStatus();
  const [heroBanner, setHeroBanner] = useState<GlanceableHeroBannerProps | null>(null);

  // Offline Buffer states
  const [offlineQueue, setOfflineQueue] = useState<ReleaseQueueItem[]>([]);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [lastFailedScan, setLastFailedScan] = useState<{
    trackingNo: string;
    mode: "auto" | "manual";
  } | null>(null);

  // Check if ready to scan
  const canScan = customer !== null;

  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [lastStatus, setLastStatus] = useState<string>("-");
  const [scanError, setScanError] = useState<ScanErrorKind | null>(null);

  // Reference for handleDetected so useHardwareScanner can call it before declaration
  const handleDetectedRef = useRef<
    (raw: string, mode: "auto" | "manual") => Promise<void>
  >(() => Promise.resolve());

  const {
    input,
    setInput,
    inputRef,
    latestInputRef,
    scanInFlightRef,
    autoEnter,
    setAutoEnter,
    showSoftKeyboard,
    toggleSoftKeyboard,
    isInputFocused,
    setIsInputFocused,
    scannedLock,
    setScannedLock,
    clearAutoSubmitTimer,
    focusTrackingInput,
    resetInput,
    handleInputChange,
    handleManualSubmit,
  } = useHardwareScanner({
    canScan,
    isLocked: scanError !== null,
    onScan: (rawValue, mode) => handleDetectedRef.current(rawValue, mode),
  });

  // Persistent History: restore per-customer scan history when customer changes
  useEffect(() => {
    if (!customer) {
      setHistory([]);
      scannedCodesRef.current.clear();
      return;
    }
    const key = getReleaseHistoryKey(customer.uuid);
    scannedCodesRef.current.clear();
    void loadScanHistory<ScanRecord>(key).then((loaded) => {
      setHistory(loaded);
      for (const item of loaded) {
        scannedCodesRef.current.add(item.code);
      }
    });
  }, [customer]);

  // Productivity Metrics & Sound States
  const [shiftMetrics, setShiftMetrics] = useState<ShiftMetrics>(
    getInitialShiftMetrics(),
  );
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundBoosted, setSoundBoosted] = useState(false);
  const [velocityTick, setVelocityTick] = useState(0);

  // Initialize Industrial Audio and Load Shift Metrics
  useEffect(() => {
    void industrialAudio.initialize().then(async () => {
      const settings = await getSoundSettings();
      setSoundEnabled(settings.enabled);
      setSoundBoosted(settings.boost);
    });
    void loadShiftMetrics(METRICS_STORAGE_KEYS.RELEASE_METRICS).then(
      setShiftMetrics,
    );
  }, []);

  // SPM velocity decay timer (refreshes calculation every 5s while active)
  useEffect(() => {
    if (shiftMetrics.recentTimestamps.length === 0) return;
    const interval = setInterval(() => {
      setVelocityTick((t) => t + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, [shiftMetrics.recentTimestamps.length]);

  const scanVelocitySpm = useMemo(() => {
    return calculateScanVelocity(shiftMetrics.recentTimestamps);
  }, [shiftMetrics.recentTimestamps, velocityTick]);

  const activeCustomerCount = useMemo(() => {
    if (!customer) return 0;
    return shiftMetrics.byCategory[customer.code] || 0;
  }, [customer, shiftMetrics.byCategory]);

  const handleResetTally = useCallback(async () => {
    const fresh = await resetShiftMetrics(METRICS_STORAGE_KEYS.RELEASE_METRICS);
    setShiftMetrics(fresh);
    triggerSuccessHaptic();
  }, []);

  const handleToggleSoundBoost = useCallback(async () => {
    const next = await industrialAudio.toggleBoost();
    setSoundBoosted(next);
    triggerSuccessHaptic();
    await industrialAudio.playSound("beep");
  }, []);

  const handleToggleSoundMute = useCallback(async () => {
    const next = await industrialAudio.toggleEnabled();
    setSoundEnabled(next);
    triggerSuccessHaptic();
  }, []);

  const idCounter = useRef(0);
  const lastScanRef = useRef({ value: "", timestamp: 0 });
  const scannedCodesRef = useRef(new Set<string>());

  useEffect(() => {
    if (!isScannerTestMode) void ensureAuthenticated();
  }, [ensureAuthenticated]);

  const loadOfflineQueue = useCallback(async () => {
    const queue = await getOfflineQueue<ReleaseQueueItem>(
      OFFLINE_STORAGE_KEYS.RELEASE_QUEUE,
    );
    setOfflineQueue(queue);
    for (const item of queue) {
      scannedCodesRef.current.add(item.trackingNo);
    }
  }, []);

  useEffect(() => {
    void loadOfflineQueue();
  }, [loadOfflineQueue]);

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

  const showScanError = useCallback(
    (kind: ScanErrorKind) => {
      resetInput();
      inputRef.current?.blur();
      setScanError(kind);
    },
    [resetInput],
  );

  const handleClearBatchHistory = useCallback(() => {
    if (!customer) return;
    Alert.alert(
      "เริ่มรอบใหม่",
      `ต้องการล้างประวัติการสแกนของลูกค้า ${customer.code} ใช่หรือไม่? (ข้อมูลในระบบจะไม่ได้รับผลกระทบ)`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ล้างประวัติ",
          style: "destructive",
          onPress: async () => {
            const key = getReleaseHistoryKey(customer.uuid);
            await clearScanHistory(key);
            setHistory([]);
            scannedCodesRef.current.clear();
            triggerSuccessHaptic();
          },
        },
      ],
    );
  }, [customer]);

  const confirmScanError = useCallback(() => {
    setScanError(null);
    setLastFailedScan(null);
    focusTrackingInput();
  }, [focusTrackingInput]);

  const playBeepPattern = useCallback(
    async (count: number) => {
      await industrialAudio.playBeepPattern(count, BEEP_GAP_MS);
    },
    [],
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
        if (customers.length === 0) {
          void loadCustomers();
        }
      }
    }, [ensureAuthenticated, loadCustomers, customers.length]),
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

  const handleSaveFailedToOffline = useCallback(
    async (overrideTracking?: string, overrideMode?: "auto" | "manual") => {
      const tracking = overrideTracking || lastFailedScan?.trackingNo;
      const mode = overrideMode || lastFailedScan?.mode || "auto";
      if (!tracking || !customer) return;

      const queueItem: ReleaseQueueItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        trackingNo: tracking,
        customerUuid: customer.uuid,
        customerCode: customer.code,
        timestamp: new Date().toISOString(),
        mode,
      };

      const updated = await addToOfflineQueue(
        OFFLINE_STORAGE_KEYS.RELEASE_QUEUE,
        queueItem,
      );
      setOfflineQueue(updated);
      scannedCodesRef.current.add(tracking);

      setScanError(null);
      setLastFailedScan(null);

      setHeroBanner({
        statusType: "warning",
        title: "บันทึกลงคิวออฟไลน์แล้ว",
        trackingCode: tracking,
        badgeLabel: "OFFLINE QUEUED",
        badgeType: "warning",
        subtitle: `บันทึกในเครื่องแล้ว (รอซิงค์ ${updated.length} รายการ)`,
      });
      setLastStatus(`${tracking} • บันทึกคิวออฟไลน์ (${customer.code})`);
      triggerSuccessHaptic();
      focusTrackingInput();
    },
    [customer, focusTrackingInput, lastFailedScan],
  );

  const handleSyncOfflineQueue = useCallback(async () => {
    if (offlineQueue.length === 0 || syncingQueue || !customer) return;
    setSyncingQueue(true);

    let syncedCount = 0;
    let failedCount = 0;
    let currentQueue = [...offlineQueue];

    for (const item of offlineQueue) {
      try {
        if (isScannerTestMode) {
          currentQueue = await removeFromOfflineQueue(
            OFFLINE_STORAGE_KEYS.RELEASE_QUEUE,
            item.id,
          );
          syncedCount += 1;

          idCounter.current += 1;
          const record: ScanRecord = {
            id: `${Date.now()}-${idCounter.current}`,
            customerId: item.customerUuid,
            customerCode: item.customerCode,
            code: item.trackingNo,
            scannedAt: new Date().toISOString(),
            mode: item.mode,
          };
          const histKey = getReleaseHistoryKey(item.customerUuid);
          const updated = await appendScanRecord(histKey, record);
          setHistory(updated);
          continue;
        }

        const apiUrl = process.env.EXPO_PUBLIC_API_URL;
        const endpoint = `${apiUrl}/v1/orders/released/${item.trackingNo}?customer_code=${item.customerCode}&device=mobile`;
        const token = await ensureAuthenticated();
        if (!token) break;

        const response = await api.get<ApiResponse>(endpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.data && response.data.code === 200) {
          currentQueue = await removeFromOfflineQueue(
            OFFLINE_STORAGE_KEYS.RELEASE_QUEUE,
            item.id,
          );
          syncedCount += 1;

          idCounter.current += 1;
          const record: ScanRecord = {
            id: `${Date.now()}-${idCounter.current}`,
            customerId: item.customerUuid,
            customerCode: item.customerCode,
            code: item.trackingNo,
            scannedAt: new Date().toISOString(),
            mode: item.mode,
          };
          const histKey = getReleaseHistoryKey(item.customerUuid);
          const updated = await appendScanRecord(histKey, record);
          setHistory(updated);
        } else {
          const msg = response.data?.message || "";
          if (
            msg.includes("ALREADY") ||
            response.data?.code === "ALREADY_RELEASED"
          ) {
            currentQueue = await removeFromOfflineQueue(
              OFFLINE_STORAGE_KEYS.RELEASE_QUEUE,
              item.id,
            );
            syncedCount += 1;
          } else {
            failedCount += 1;
          }
        }
      } catch (err: any) {
        console.error(`Sync error for ${item.trackingNo}:`, err);
        if (
          !err?.response ||
          err?.code === "ECONNABORTED" ||
          err?.message?.includes("Network")
        ) {
          failedCount += 1;
          break;
        }
      }
    }

    setOfflineQueue(currentQueue);
    setSyncingQueue(false);

    if (syncedCount > 0) {
      triggerSuccessHaptic();
      void industrialAudio.playSound("success");
      setHeroBanner({
        statusType: "success",
        title: `ซิงค์สำเร็จ ${syncedCount} รายการ!`,
        badgeLabel: "SYNCED",
        badgeType: "default",
        subtitle:
          currentQueue.length > 0
            ? `ยังเหลืออีก ${currentQueue.length} รายการในคิว`
            : "ข้อมูลปล่อยออกทั้งหมดถูกส่งขึ้นระบบเรียบร้อยแล้ว",
      });
      setLastStatus(`ซิงค์คิวสำเร็จ (${syncedCount} รายการ)`);
    } else if (failedCount > 0) {
      triggerWarningHaptic();
      setHeroBanner({
        statusType: "warning",
        title: "การซิงค์ยังไม่เสร็จสิ้น",
        badgeLabel: "RETRY",
        badgeType: "warning",
        subtitle: "กรุณาตรวจสอบสัญญาณอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง",
      });
    }
    focusTrackingInput();
  }, [
    customer,
    ensureAuthenticated,
    focusTrackingInput,
    offlineQueue,
    syncingQueue,
  ]);

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

      const testOutcome = isScannerTestMode
        ? getScannerTestOutcome(normalized)
        : null;
      const isTestSpecialCase =
        isScannerTestMode &&
        (testOutcome === "invalid" || testOutcome === "system");

      const isDuplicate =
        !isTestSpecialCase &&
        (scannedCodesRef.current.has(normalized) ||
          isTrackingInQueue(offlineQueue, normalized) ||
          history.some((h) => h.code === normalized));
      if (isDuplicate) {
        setLastStatus(`${normalized} • ยิงออกซ้ำในเครื่องนี้`);
        setHeroBanner({
          statusType: "error",
          title: "ยิงออกซ้ำแล้ว! (DUPLICATE)",
          trackingCode: normalized,
          badgeLabel: "DUPLICATE",
          badgeType: "error",
          subtitle: "รายการนี้ถูกยิงปล่อยออกในรอบนี้ไปแล้ว",
        });
        showScanError("duplicate");
        triggerWarningHaptic();
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
          const testKey = getReleaseHistoryKey(customer.uuid);
          void appendScanRecord(testKey, record).then(setHistory);
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
          resetInput();
          void industrialAudio.playSound("success");
          void recordScanMetric(
            METRICS_STORAGE_KEYS.RELEASE_METRICS,
            customer.code,
          ).then(setShiftMetrics);
          return;
        }

        if (__DEV__) {
          console.log("=== Scan Request ===", normalized, customer.code);
        }

        const apiUrl = process.env.EXPO_PUBLIC_API_URL;
        const endpoint = `${apiUrl}/v1/orders/released/${normalized}?customer_code=${customer.code}&device=mobile`;

        const token = await ensureAuthenticated();
        if (!token) {
          return;
        }

        const response = await api.get<ApiResponse>(endpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (__DEV__) {
          console.log("=== Scan Response ===", response.data);
        }

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
          const liveKey = getReleaseHistoryKey(customer.uuid);
          void appendScanRecord(liveKey, record).then(setHistory);
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
          resetInput();
          void industrialAudio.playSound("success");
          void recordScanMetric(
            METRICS_STORAGE_KEYS.RELEASE_METRICS,
            customer.code,
          ).then(setShiftMetrics);
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

        const isNetworkErr =
          !error?.response ||
          error?.code === "ECONNABORTED" ||
          error?.message?.includes("Network");
        const status = Number(error?.response?.status);
        const systemFailure =
          isNetworkErr || status === 401 || status === 403 || status >= 500;
        const errorKind = classifyScanError(
          errorMessage,
          errorCode,
          systemFailure,
        );

        if (isNetworkErr || systemFailure) {
          setLastFailedScan({ trackingNo: normalized, mode });
        }

        setLastStatus(`${normalized} • ${getScanErrorMessage(errorKind)}`);
        setHeroBanner({
          statusType: "error",
          title: isNetworkErr
            ? "สัญญาณขาดหาย (Offline)"
            : getScanErrorMessage(errorKind),
          trackingCode: normalized,
          badgeLabel: isNetworkErr ? "OFFLINE" : "ERROR",
          badgeType: "error",
          subtitle: isNetworkErr
            ? "ไม่สามารถส่งข้อมูลได้ — แตะ 'บันทึกคิวออฟไลน์' เพื่อทำงานต่อ"
            : errorMessage,
          actionText:
            isNetworkErr || systemFailure ? "บันทึกคิวออฟไลน์" : undefined,
          onActionPress:
            isNetworkErr || systemFailure
              ? () => void handleSaveFailedToOffline(normalized, mode)
              : undefined,
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
      customer,
      ensureAuthenticated,
      focusTrackingInput,
      handleSaveFailedToOffline,
      history,
      offlineQueue,
      playErrorSound,
      resetInput,
      showScanError,
    ],
  );

  handleDetectedRef.current = handleDetected;

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

  const handleSelectCustomerFromModal = useCallback(
    (item: ThumbModalItem) => {
      const target = customers.find((c) => c.uuid === item.id);
      if (target) handleSelectCustomer(target);
    },
    [customers, handleSelectCustomer],
  );

  const handleCloseCustomerModal = useCallback(() => {
    setShowCustomerModal(false);
    focusTrackingInput();
  }, [focusTrackingInput]);

  const renderHistoryItem = useCallback(
    ({ item, index }: { item: ScanRecord; index: number }) => (
      <ReleaseHistoryRow
        item={item}
        scanNumber={history.length - index}
        isLatest={index === 0}
      />
    ),
    [history.length],
  );

  const historyKeyExtractor = useCallback((item: ScanRecord) => item.id, []);

  return (
    <TouchableWithoutFeedback onPress={focusTrackingInput} accessible={false}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScanErrorModal
          kind={scanError}
          onConfirm={confirmScanError}
          onSaveToOffline={
            lastFailedScan ? () => void handleSaveFailedToOffline() : undefined
          }
        />

        {/* Thumb-friendly Customer Selection Modal */}
        <ThumbSelectionModal
          visible={showCustomerModal}
          title="เลือกลูกค้า (Select Customer)"
          subtitle="แตะเลือกลูกค้าสำหรับปล่อยพัสดุออก"
          items={modalCustomerItems}
          searchPlaceholder="ค้นหาด้วยชื่อ, รหัส, อีเมล หรือเบอร์..."
          searchValue={customerSearch}
          onSearchChange={setCustomerSearch}
          onSelectItem={handleSelectCustomerFromModal}
          onClose={handleCloseCustomerModal}
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

        {/* Compact Header - App Title + Network Status + Logout */}
        <View style={styles.compactHeader}>
          <View style={styles.compactHeaderContent}>
            <View style={styles.compactHeaderTitleRow}>
              <Image
                source={require("../../assets/images/ship2cu_favicon.png")}
                style={styles.headerFavicon}
                resizeMode="contain"
              />
              <Text style={styles.compactHeaderTitle}>SHIP2CU Release</Text>
            </View>
          </View>
          <NetworkStatusBadge
            isOnline={isOnline}
            isTestMode={isScannerTestMode}
          />
          <TouchableOpacity
            style={styles.headerLogoutButton}
            onPress={handleLogout}
            delayPressIn={200}
            activeOpacity={0.7}
          >
            <Text style={styles.headerLogoutText}>ออกจากระบบ</Text>
          </TouchableOpacity>
        </View>

        {/* Productivity Metrics Bar (Shift Tally, Scan Velocity SPM, Customer Count, Sound Booster) */}
        <ProductivityMetricsBar
          totalScans={shiftMetrics.totalScans}
          scanVelocitySpm={scanVelocitySpm}
          currentCategoryLabel={customer ? customer.code : "เลือกลูกค้า"}
          currentCategoryCount={activeCustomerCount}
          soundEnabled={soundEnabled}
          soundBoosted={soundBoosted}
          onResetTally={handleResetTally}
          onToggleSoundBoost={handleToggleSoundBoost}
          onToggleSoundMute={handleToggleSoundMute}
        />

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
                  title="⚡ สลับลูกค้าด่วน:"
                  items={quickCustomerChips}
                  onSelect={(chip) => {
                    const target = customers.find((c) => c.uuid === chip.id);
                    if (!target || target.uuid === customer?.uuid) return;
                    Alert.alert(
                      "ยืนยันสลับลูกค้า",
                      `ต้องการสลับเครื่องจากลูกค้า "${customer?.name || "-"}" ไปเป็น "${target.name}" ใช่หรือไม่?`,
                      [
                        { text: "ยกเลิก", style: "cancel" },
                        {
                          text: "ยืนยันสลับลูกค้า",
                          style: "default",
                          onPress: () => {
                            handleSelectCustomer(target);
                          },
                        },
                      ],
                    );
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

            {/* Offline Sync Banner (Visible when items waiting in queue) */}
            <OfflineSyncBanner
              count={offlineQueue.length}
              syncing={syncingQueue}
              onSync={() => void handleSyncOfflineQueue()}
            />

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
                    onPress={toggleSoftKeyboard}
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
                <Text style={styles.sectionTitle}>
                  ประวัติการสแกน {customer ? `(${customer.code})` : ""}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={styles.historyCount}>{history.length} รายการ</Text>
                  {history.length > 0 && (
                    <TouchableOpacity
                      onPress={handleClearBatchHistory}
                      style={styles.clearBatchBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.clearBatchBtnText}>ล้างรอบ</Text>
                    </TouchableOpacity>
                  )}
                </View>
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
                <FlatList
                  data={history}
                  keyExtractor={historyKeyExtractor}
                  renderItem={renderHistoryItem}
                  style={styles.historyScroll}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  initialNumToRender={8}
                  maxToRenderPerBatch={8}
                  windowSize={3}
                  removeClippedSubviews={Platform.OS === "android"}
                />
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
  compactHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerFavicon: {
    width: 24,
    height: 24,
    marginRight: 8,
    borderRadius: 5,
  },
  compactHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(252, 211, 77, 1.00)",
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
  clearBatchBtn: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  clearBatchBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#DC2626",
  },
});
