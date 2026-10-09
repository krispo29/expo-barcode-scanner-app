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
  ChangeLotModal,
  extractOriginalLot,
  findLotByCodeOrRef,
  isLotMismatchError,
} from "../components/ChangeLotModal";
import {
  GlanceableHeroBanner,
  GlanceableHeroBannerProps,
} from "../components/GlanceableHeroBanner";
import { TrackingCodeText } from "../components/TrackingCodeText";
import { QuickChips, QuickChipItem } from "../components/QuickChips";
import {
  ThumbSelectionModal,
  ThumbModalItem,
  ThumbFilterTab,
} from "../components/ThumbSelectionModal";
import { OfflineSyncBanner } from "../components/OfflineSyncBanner";
import {
  addToOfflineQueue,
  clearOfflineQueue,
  getOfflineQueue,
  isTrackingInQueue,
  OFFLINE_STORAGE_KEYS,
  ReceiveQueueItem,
  removeFromOfflineQueue,
} from "../../utils/offlineQueue";
import { updateRecentIds } from "../../utils/recentSelections";
import { showConfirmDialog } from "../../utils/dialogs";
import { clearStoredAuth, getValidAccessToken } from "../../utils/auth";
import api from "../../utils/api";
import {
  getScannerTestOutcome,
  isScannerTestMode,
  LotNo,
  TEST_LOTS,
} from "../../utils/scannerTestMode";
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
  clearAllScanHistoryCacheForTesting,
  clearScanHistory,
  getReceiveHistoryKey,
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

type ScanRecord = {
  id: string;
  code: string;
  scannedAt: string;
  mode: "auto" | "manual";
  status?: "success" | "lot_mismatch";
  shippingType?: string;
  originalLot?: string;
  targetLot?: string;
  customerCode?: string;
  productName?: string;
};

type ApiResponse<T = any> = {
  code: number | string;
  message?: string;
  data: T;
};

const SCANNER_AUTO_SUBMIT_DELAY_MS = 150;
const BEEP_GAP_MS = 160;

// Memoized Scan History Row: eliminates 90%+ re-renders across existing items when new scans arrive
const ReceiveHistoryRow = React.memo(function ReceiveHistoryRow({
  item,
  scanNumber,
  isLatest,
  onLotMismatchPress,
}: {
  item: ScanRecord;
  scanNumber: number;
  isLatest: boolean;
  onLotMismatchPress: (item: ScanRecord) => void;
}) {
  const scanTime = new Date(item.scannedAt);
  const isMismatch = item.status === "lot_mismatch";

  return (
    <View
      style={[
        styles.historyItem,
        isLatest && styles.historyItemLatest,
        isMismatch && styles.historyItemMismatch,
      ]}
    >
      <View style={styles.historyLeft}>
        <View
          style={[
            styles.historyIcon,
            isLatest && styles.historyIconLatest,
            isMismatch && styles.historyIconMismatch,
          ]}
        >
          <Text style={styles.historyIconText}>
            {isMismatch ? "⚠️" : isLatest ? "🆕" : "📦"}
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
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            {isMismatch ? (
              <View style={styles.historyBadgeMismatch}>
                <Text style={styles.historyBadgeMismatchText}>Lot ไม่ตรง</Text>
              </View>
            ) : (
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
            )}
          </View>
        </View>
        <View style={styles.historyDetails}>
          {isMismatch ? (
            <View style={styles.mismatchDetailsRow}>
              <Text style={styles.originalLotText}>
                :: {item.originalLot || "ไม่ระบุ Lot"}
              </Text>
              <TouchableOpacity
                style={styles.changeLotBtn}
                onPress={() => onLotMismatchPress(item)}
              >
                <Text style={styles.changeLotBtnText}>เปลี่ยน Lot</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.historyLotText}>
              Lot: {item.targetLot || "-"}
            </Text>
          )}
          <Text style={styles.historyTime}>
            🕐 {scanTime.toLocaleString("th-TH")}
          </Text>
        </View>
      </View>
    </View>
  );
});

export default function ReceiveScreen() {
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

  // Lot Selection states
  const [selectedLot, setSelectedLot] = useState<LotNo | null>(null);
  const [lots, setLots] = useState<LotNo[]>([]);
  const [loadingLots, setLoadingLots] = useState(false);
  const [showLotModal, setShowLotModal] = useState(false);
  const [lotSearch, setLotSearch] = useState("");
  const [recentLotMawbs, setRecentLotMawbs] = useState<string[]>([]);
  const [lotFilterTab, setLotFilterTab] = useState<string>("all");

  // Change Lot Modal states
  const [lotMismatchData, setLotMismatchData] = useState<{
    trackingNo: string;
    originalLot: string;
    newLot: LotNo;
  } | null>(null);
  const [changeLotLoading, setChangeLotLoading] = useState(false);

  const { isOnline } = useNetworkStatus();
  const [heroBanner, setHeroBanner] = useState<GlanceableHeroBannerProps | null>(null);

  // Offline Buffer states
  const [offlineQueue, setOfflineQueue] = useState<ReceiveQueueItem[]>([]);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [lastFailedScan, setLastFailedScan] = useState<{
    trackingNo: string;
    mode: "auto" | "manual";
  } | null>(null);

  // Check if ready to scan
  const canScan = selectedLot !== null;

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
    isLocked: scanError !== null || lotMismatchData !== null,
    onScan: (rawValue, mode) => handleDetectedRef.current(rawValue, mode),
  });

  // Persistent History: restore per-lot scan history when selectedLot changes
  useEffect(() => {
    if (!selectedLot) {
      setHistory([]);
      scannedCodesRef.current.clear();
      return;
    }
    const key = getReceiveHistoryKey(selectedLot.mawbUUID);
    scannedCodesRef.current.clear();
    void loadScanHistory<ScanRecord>(key).then((loaded) => {
      setHistory(loaded);
      for (const item of loaded) {
        if (item.status === "success") {
          scannedCodesRef.current.add(item.code);
        }
      }
    });
  }, [selectedLot]);

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
    void loadShiftMetrics(METRICS_STORAGE_KEYS.RECEIVE_METRICS).then(
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

  const activeLotCount = useMemo(() => {
    if (!selectedLot) return 0;
    return shiftMetrics.byCategory[selectedLot.refLotNo] || 0;
  }, [selectedLot, shiftMetrics.byCategory]);

  const handleResetTally = useCallback(async () => {
    const fresh = await resetShiftMetrics(METRICS_STORAGE_KEYS.RECEIVE_METRICS);
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

  // โฟกัสช่อง Tracking Number อัตโนมัติเมื่อเลือก Lot แล้ว และ modal ปิด
  useEffect(() => {
    if (selectedLot && !showLotModal && inputRef.current) {
      focusTrackingInput();
    }
  }, [focusTrackingInput, selectedLot, showLotModal]);


  useEffect(() => {
    if (!isScannerTestMode) void ensureAuthenticated();
  }, [ensureAuthenticated]);

  const loadOfflineQueue = useCallback(async () => {
    const queue = await getOfflineQueue<ReceiveQueueItem>(
      OFFLINE_STORAGE_KEYS.RECEIVE_QUEUE,
    );
    setOfflineQueue(queue);
    for (const item of queue) {
      scannedCodesRef.current.add(item.trackingNo);
    }
  }, []);

  useEffect(() => {
    void loadOfflineQueue();
  }, [loadOfflineQueue]);

  const loadLots = useCallback(async () => {
    if (isScannerTestMode) {
      setLots(TEST_LOTS);
      setSelectedLot((prev) => prev || TEST_LOTS[0]);
      setRecentLotMawbs(TEST_LOTS.map((l) => l.mawbUUID));
      return;
    }

    setLoadingLots(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      const endpoint = `${apiUrl}/v1/lot_nos/all`;

      const token = await ensureAuthenticated();
      if (!token) return;

      const response = await api.get<ApiResponse<LotNo[]>>(endpoint, {
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
        const fetchedLots = response.data.data;
        setLots(fetchedLots);

        // ดึง Lot ที่เลือกไว้ล่าสุดจาก storage
        const savedMawbUUID = await AsyncStorage.getItem("@selected_lot_mawb");
        if (savedMawbUUID) {
          const match = fetchedLots.find((l) => l.mawbUUID === savedMawbUUID);
          if (match) setSelectedLot(match);
        }

        // ดึงรายการ Lot ล่าสุด (Recents)
        const savedRecents = await AsyncStorage.getItem("@recent_lots");
        if (savedRecents) {
          try {
            setRecentLotMawbs(JSON.parse(savedRecents));
          } catch (e) {
            console.error("Error parsing recent lots:", e);
          }
        }
      }
    } catch (error) {
      console.error("Error loading lot nos:", error);
    } finally {
      setLoadingLots(false);
    }
  }, [ensureAuthenticated]);

  useEffect(() => {
    void loadLots();
  }, [loadLots]);

  useFocusEffect(
    useCallback(() => {
      if (!isScannerTestMode) {
        void ensureAuthenticated();
        if (lots.length === 0) {
          void loadLots();
        }
      }
    }, [ensureAuthenticated, loadLots, lots.length]),
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

  const handleSelectLot = useCallback(
    (lot: LotNo) => {
      setSelectedLot(lot);
      setShowLotModal(false);
      void AsyncStorage.setItem("@selected_lot_mawb", lot.mawbUUID);
      setRecentLotMawbs((prev) => {
        const next = updateRecentIds(prev, lot.mawbUUID, 4);
        void AsyncStorage.setItem("@recent_lots", JSON.stringify(next));
        return next;
      });
      triggerSuccessHaptic();
      setHeroBanner({
        statusType: "idle",
        title: `เลือก Lot: ${lot.refLotNo}`,
        subtitle: `พร้อมสแกนพัสดุสำหรับ Lot ${lot.code}`,
        badgeLabel: lot.shippingTypeCode?.toUpperCase(),
        badgeType: lot.shippingTypeCode?.toLowerCase() === "sea" ? "sea" : "air",
      });
      focusTrackingInput();
    },
    [focusTrackingInput],
  );

  const handleSwitchDeviceLot = useCallback(
    (targetLot: LotNo) => {
      handleSelectLot(targetLot);
      setLotMismatchData(null);
      setHeroBanner({
        statusType: "idle",
        title: `สลับเครื่องเป็น: ${targetLot.refLotNo}`,
        subtitle: `เปลี่ยนเป็น Lot ${targetLot.code} เรียบร้อยแล้ว พร้อมสแกนต่อทันที`,
        badgeLabel: targetLot.shippingTypeCode?.toUpperCase(),
        badgeType: targetLot.shippingTypeCode?.toLowerCase() === "sea" ? "sea" : "air",
      });
      focusTrackingInput();
    },
    [focusTrackingInput, handleSelectLot],
  );

  const handleSaveFailedToOffline = useCallback(
    async (overrideTracking?: string, overrideMode?: "auto" | "manual") => {
      const tracking = overrideTracking || lastFailedScan?.trackingNo;
      const mode = overrideMode || lastFailedScan?.mode || "auto";
      if (!tracking || !selectedLot) return;

      const queueItem: ReceiveQueueItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        trackingNo: tracking,
        mawbUUID: selectedLot.mawbUUID,
        lotRef: selectedLot.refLotNo,
        shippingType: selectedLot.shippingTypeCode,
        timestamp: new Date().toISOString(),
        mode,
      };

      const updated = await addToOfflineQueue(
        OFFLINE_STORAGE_KEYS.RECEIVE_QUEUE,
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
      setLastStatus(`${tracking} • บันทึกคิวออฟไลน์ (${selectedLot.refLotNo})`);
      triggerSuccessHaptic();
      focusTrackingInput();
    },
    [focusTrackingInput, lastFailedScan, selectedLot],
  );

  const handleClearBatchHistory = useCallback(() => {
    if (!selectedLot) return;
    showConfirmDialog({
      title: "เริ่มรอบใหม่",
      message: `ต้องการล้างประวัติการสแกนของ Lot ${selectedLot.refLotNo} ใช่หรือไม่? (ข้อมูลในระบบจะไม่ได้รับผลกระทบ)`,
      confirmText: "ล้างประวัติ",
      cancelText: "ยกเลิก",
      destructive: true,
      onConfirm: async () => {
        const key = getReceiveHistoryKey(selectedLot.mawbUUID);
        await clearScanHistory(key);
        setHistory([]);
        scannedCodesRef.current.clear();
        triggerSuccessHaptic();
        focusTrackingInput();
      },
    });
  }, [focusTrackingInput, selectedLot]);

  const handleResetAllTestData = useCallback(async () => {
    for (const lot of TEST_LOTS) {
      await clearScanHistory(getReceiveHistoryKey(lot.mawbUUID));
    }
    clearAllScanHistoryCacheForTesting();
    await resetShiftMetrics(METRICS_STORAGE_KEYS.RECEIVE_METRICS);
    await clearOfflineQueue(OFFLINE_STORAGE_KEYS.RECEIVE_QUEUE);

    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (
            k &&
            (k.startsWith("@scan_history") ||
              k.startsWith("@shift_metrics") ||
              k.startsWith("@offline_queue"))
          ) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => window.localStorage.removeItem(k));
      } catch (e) {
        console.warn("Failed to clear localStorage:", e);
      }
    }

    scannedCodesRef.current.clear();
    setHistory([]);
    setOfflineQueue([]);
    setShiftMetrics(getInitialShiftMetrics());
    setHeroBanner(null);
    setLastStatus("-");
    setScanError(null);
    setLastFailedScan(null);
    setLotMismatchData(null);
    triggerSuccessHaptic();
    focusTrackingInput();
  }, [focusTrackingInput]);

  const handleSyncOfflineQueue = useCallback(async () => {
    if (offlineQueue.length === 0 || syncingQueue || !selectedLot) return;
    setSyncingQueue(true);

    let syncedCount = 0;
    let failedCount = 0;
    let currentQueue = [...offlineQueue];

    for (const item of offlineQueue) {
      try {
        if (isScannerTestMode) {
          currentQueue = await removeFromOfflineQueue(
            OFFLINE_STORAGE_KEYS.RECEIVE_QUEUE,
            item.id,
          );
          syncedCount += 1;

          idCounter.current += 1;
          const record: ScanRecord = {
            id: `${Date.now()}-${idCounter.current}`,
            code: item.trackingNo,
            scannedAt: new Date().toISOString(),
            mode: item.mode,
            status: "success",
            shippingType: item.shippingType || "air",
            targetLot: item.lotRef,
          };
          const key = getReceiveHistoryKey(item.mawbUUID);
          const updated = await appendScanRecord(key, record);
          setHistory(updated);
          continue;
        }

        const apiUrl = process.env.EXPO_PUBLIC_API_URL;
        const endpoint = `${apiUrl}/v1/orders/received_inbound/${item.trackingNo}?mawbUUID=${item.mawbUUID}&device=mobile`;
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
            OFFLINE_STORAGE_KEYS.RECEIVE_QUEUE,
            item.id,
          );
          syncedCount += 1;

          idCounter.current += 1;
          const shippingType =
            response.data.data?.shippingTypeCode?.toLowerCase() ||
            item.shippingType ||
            "air";

          const record: ScanRecord = {
            id: `${Date.now()}-${idCounter.current}`,
            code: item.trackingNo,
            scannedAt: new Date().toISOString(),
            mode: item.mode,
            status: "success",
            shippingType,
            targetLot: item.lotRef,
            customerCode: response.data.data?.customerCode,
            productName:
              response.data.data?.productName || response.data.data?.product,
          };
          const key = getReceiveHistoryKey(item.mawbUUID);
          const updated = await appendScanRecord(key, record);
          setHistory(updated);
        } else {
          const msg = response.data?.message || "";
          if (
            msg.includes("ALREADY") ||
            response.data?.code === "ALREADY_RECEIVED"
          ) {
            currentQueue = await removeFromOfflineQueue(
              OFFLINE_STORAGE_KEYS.RECEIVE_QUEUE,
              item.id,
            );
            syncedCount += 1;
          } else {
            failedCount += 1;
          }
        }
      } catch (err: any) {
        console.error(`Sync error for ${item.trackingNo}:`, err);
        if (!err?.response || err?.code === "ECONNABORTED") {
          failedCount += 1;
          break;
        }
      }
    }

    setOfflineQueue(currentQueue);
    setSyncingQueue(false);

    if (syncedCount > 0) {
      triggerSuccessHaptic();
      void industrialAudio.playSound("air");
      setHeroBanner({
        statusType: "success",
        title: `ซิงค์สำเร็จ ${syncedCount} รายการ!`,
        badgeLabel: "SYNCED",
        badgeType: "default",
        subtitle:
          currentQueue.length > 0
            ? `ยังเหลืออีก ${currentQueue.length} รายการในคิว`
            : "ข้อมูลทั้งหมดถูกส่งขึ้นระบบเรียบร้อยแล้ว",
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
    ensureAuthenticated,
    focusTrackingInput,
    offlineQueue,
    selectedLot,
    syncingQueue,
  ]);

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

  const showScanError = useCallback(
    (kind: ScanErrorKind) => {
      resetInput();
      inputRef.current?.blur();
      setScanError(kind);
    },
    [resetInput],
  );

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

  const handleDetected = useCallback(
    async (rawValue: string, mode: "auto" | "manual") => {
      clearAutoSubmitTimer();

      if (!selectedLot) {
        Alert.alert("แจ้งเตือน", "กรุณาเลือก Lot No. ก่อนเริ่มสแกน");
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
        (testOutcome === "lot_mismatch" ||
          testOutcome === "invalid" ||
          testOutcome === "system");

      const isDuplicate =
        !isTestSpecialCase &&
        (scannedCodesRef.current.has(normalized) ||
          isTrackingInQueue(offlineQueue, normalized) ||
          history.some((h) => h.code === normalized && h.status === "success"));
      if (isDuplicate) {
        setLastStatus(`${normalized} • สแกนซ้ำในเครื่องนี้`);
        setHeroBanner({
          statusType: "error",
          title: "สแกนซ้ำแล้ว! (DUPLICATE)",
          trackingCode: normalized,
          badgeLabel: "DUPLICATE",
          badgeType: "error",
          subtitle: "รายการนี้ถูกสแกนในรอบนี้ไปแล้ว",
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

      const triggerLotMismatch = (trackingNo: string, errorMsg: string) => {
        const originalLot = extractOriginalLot(errorMsg);
        modalOpened = true;
        triggerWarningHaptic();
        void playErrorSound("generic");

        const matchingLot = findLotByCodeOrRef(lots, originalLot);

        idCounter.current += 1;
        const record: ScanRecord = {
          id: `${Date.now()}-${idCounter.current}`,
          code: trackingNo,
          scannedAt: new Date().toISOString(),
          mode,
          status: "lot_mismatch",
          originalLot,
          targetLot: selectedLot.refLotNo,
        };
        const key = getReceiveHistoryKey(selectedLot.mawbUUID);
        void appendScanRecord(key, record).then(setHistory);
        setLastStatus(
          `${trackingNo} • Lot ไม่ตรง (${originalLot || "ไม่ระบุ"})`,
        );

        setHeroBanner({
          statusType: "warning",
          title: "แจ้งเตือน: Lot ไม่ตรง!",
          trackingCode: trackingNo,
          badgeLabel: "Lot Mismatch",
          badgeType: "warning",
          subtitle: `Lot เดิม: ${originalLot || "ไม่ระบุ"} | เลือก Lot: ${selectedLot.refLotNo}`,
          actionText: "เปลี่ยน Lot",
          onActionPress: () => {
            setLotMismatchData({
              trackingNo,
              originalLot: originalLot || "",
              newLot: selectedLot,
            });
          },
        });

        resetInput();
        inputRef.current?.blur();

        setLotMismatchData({
          trackingNo,
          originalLot,
          newLot: selectedLot,
        });
      };

      try {
        if (isScannerTestMode) {
          const outcome = getScannerTestOutcome(normalized);
          if (outcome === "lot_mismatch") {
            const mismatchLot =
              selectedLot.refLotNo === "TEST-LOT-RECEIVE-001"
                ? "TEST-LOT-RECEIVE-002"
                : "TEST-LOT-RECEIVE-001";
            triggerLotMismatch(
              normalized,
              `LOT_NO_NOT_MATCH:${mismatchLot}`,
            );
            return;
          }

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

          const shippingType =
            selectedLot.shippingTypeCode?.toLowerCase() || "air";
          idCounter.current += 1;
          const record: ScanRecord = {
            id: `${Date.now()}-${idCounter.current}`,
            code: normalized,
            scannedAt: new Date().toISOString(),
            mode,
            status: "success",
            shippingType,
            targetLot: selectedLot.refLotNo,
          };
          scannedCodesRef.current.add(normalized);
          const testKey = getReceiveHistoryKey(selectedLot.mawbUUID);
          void appendScanRecord(testKey, record).then(setHistory);
          setLastStatus(`${normalized} • ${shippingType.toUpperCase()}`);
          setHeroBanner({
            statusType: "success",
            title: "รับเข้าสำเร็จ",
            trackingCode: normalized,
            badgeLabel: shippingType.toUpperCase(),
            badgeType: shippingType === "sea" ? "sea" : "air",
            subtitle: `Lot: ${selectedLot.refLotNo} • เวลา ${new Date().toLocaleTimeString("th-TH")}`,
          });
          triggerSuccessHaptic();
          resetInput();
          if (shippingType === "sea") {
            void industrialAudio.playSound("sea");
          } else {
            void industrialAudio.playSound("air");
          }
          void recordScanMetric(
            METRICS_STORAGE_KEYS.RECEIVE_METRICS,
            selectedLot.refLotNo,
          ).then(setShiftMetrics);
          return;
        }

        if (__DEV__) {
          console.log("=== Scan Request ===", normalized, selectedLot.mawbUUID);
        }

        const apiUrl = process.env.EXPO_PUBLIC_API_URL;
        const endpoint = `${apiUrl}/v1/orders/received_inbound/${normalized}?mawbUUID=${selectedLot.mawbUUID}&device=mobile`;

        const token = await ensureAuthenticated();
        if (!token) return;

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
          const shippingType =
            response.data.data?.shippingTypeCode?.toLowerCase() ||
            selectedLot.shippingTypeCode?.toLowerCase() ||
            "air";

          idCounter.current += 1;
          const record: ScanRecord = {
            id: `${Date.now()}-${idCounter.current}`,
            code: normalized,
            scannedAt: new Date().toISOString(),
            mode,
            status: "success",
            shippingType,
            targetLot: selectedLot.refLotNo,
            customerCode: response.data.data?.customerCode,
            productName:
              response.data.data?.productName || response.data.data?.product,
          };

          scannedCodesRef.current.add(normalized);
          const liveKey = getReceiveHistoryKey(selectedLot.mawbUUID);
          void appendScanRecord(liveKey, record).then(setHistory);
          setLastStatus(`${normalized} • ${shippingType.toUpperCase()}`);

          const productDesc =
            response.data.data?.productName ||
            response.data.data?.product ||
            (response.data.data?.customerCode
              ? `ลูกค้า: ${response.data.data.customerCode}`
              : `Lot: ${selectedLot.refLotNo}`);

          setHeroBanner({
            statusType: "success",
            title: "รับเข้าสำเร็จ",
            trackingCode: normalized,
            badgeLabel: shippingType.toUpperCase(),
            badgeType: shippingType === "sea" ? "sea" : "air",
            subtitle: `${productDesc} • เวลา ${new Date().toLocaleTimeString("th-TH")}`,
          });
          triggerSuccessHaptic();
          resetInput();

          if (shippingType === "sea") {
            void industrialAudio.playSound("sea");
          } else {
            void industrialAudio.playSound("air");
          }
          void recordScanMetric(
            METRICS_STORAGE_KEYS.RECEIVE_METRICS,
            selectedLot.refLotNo,
          ).then(setShiftMetrics);
        } else {
          const responseMsg = response.data?.message;
          if (isLotMismatchError(responseMsg)) {
            triggerLotMismatch(normalized, responseMsg!);
            return;
          }

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
            subtitle: "กรุณากดยืนยันเพื่อดำเนินการต่อ",
          });
          modalOpened = true;
          showScanError(errorKind);
          triggerErrorHaptic();
          void playErrorSound(errorKind);
        }
      } catch (error: any) {
        console.error("Scan error:", error);
        const responseMsg =
          error?.response?.data?.message || error?.message || "";

        if (isLotMismatchError(responseMsg)) {
          triggerLotMismatch(normalized, responseMsg);
          return;
        }

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
      clearAutoSubmitTimer,
      ensureAuthenticated,
      focusTrackingInput,
      handleSaveFailedToOffline,
      history,
      offlineQueue,
      playErrorSound,
      selectedLot,
      showScanError,
    ],
  );

  handleDetectedRef.current = handleDetected;

  const handleConfirmChangeLot = useCallback(async () => {
    if (!lotMismatchData) return;
    const { trackingNo, newLot } = lotMismatchData;
    setChangeLotLoading(true);

    try {
      if (isScannerTestMode) {
        setLotMismatchData(null);
        scannedCodesRef.current.add(trackingNo);
        const updatedRecord: ScanRecord = {
          id: `${Date.now()}-${idCounter.current}`,
          code: trackingNo,
          scannedAt: new Date().toISOString(),
          mode: "manual",
          status: "success",
          targetLot: newLot.refLotNo,
          shippingType: newLot.shippingTypeCode?.toLowerCase() || "air",
        };
        const key = getReceiveHistoryKey(newLot.mawbUUID);
        void appendScanRecord(key, updatedRecord).then(setHistory);
        setLastStatus(
          `${trackingNo} • เปลี่ยน Lot สำเร็จ (${newLot.refLotNo})`,
        );
        setHeroBanner({
          statusType: "success",
          title: "เปลี่ยน Lot สำเร็จ",
          trackingCode: trackingNo,
          badgeLabel: newLot.shippingTypeCode?.toUpperCase(),
          badgeType:
            newLot.shippingTypeCode?.toLowerCase() === "sea" ? "sea" : "air",
          subtitle: `ย้ายเข้า Lot: ${newLot.refLotNo}`,
        });
        triggerSuccessHaptic();
        void industrialAudio.playSound("air");
        void recordScanMetric(
          METRICS_STORAGE_KEYS.RECEIVE_METRICS,
          newLot.refLotNo,
        ).then(setShiftMetrics);
        focusTrackingInput();
        return;
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      const shippingType = newLot.shippingTypeCode?.toLowerCase() || "air";
      const endpoint = `${apiUrl}/v1/orders/received_inbound/${trackingNo}?newMawbUUID=${newLot.mawbUUID}&shippingType=${shippingType}&device=mobile`;

      const token = await ensureAuthenticated();
      if (!token) return;

      const response = await api.get<ApiResponse>(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.data && response.data.code === 200) {
        setLotMismatchData(null);
        scannedCodesRef.current.add(trackingNo);
        const updatedRecord: ScanRecord = {
          id: `${Date.now()}-${idCounter.current}`,
          code: trackingNo,
          scannedAt: new Date().toISOString(),
          mode: "manual",
          status: "success",
          targetLot: newLot.refLotNo,
          shippingType,
        };
        const key = getReceiveHistoryKey(newLot.mawbUUID);
        void appendScanRecord(key, updatedRecord).then(setHistory);
        setLastStatus(
          `${trackingNo} • เปลี่ยน Lot สำเร็จ (${newLot.refLotNo})`,
        );
        setHeroBanner({
          statusType: "success",
          title: "เปลี่ยน Lot สำเร็จ",
          trackingCode: trackingNo,
          badgeLabel: shippingType.toUpperCase(),
          badgeType: shippingType === "sea" ? "sea" : "air",
          subtitle: `ย้ายเข้า Lot: ${newLot.refLotNo}`,
        });
        triggerSuccessHaptic();
        if (shippingType === "sea") {
          void industrialAudio.playSound("sea");
        } else {
          void industrialAudio.playSound("air");
        }
        void recordScanMetric(
          METRICS_STORAGE_KEYS.RECEIVE_METRICS,
          newLot.refLotNo,
        ).then(setShiftMetrics);
        focusTrackingInput();
      } else {
        Alert.alert(
          "เกิดข้อผิดพลาด",
          response.data?.message || "ไม่สามารถเปลี่ยน Lot ได้",
        );
      }
    } catch (err: any) {
      console.error("Change lot error:", err);
      const msg =
        err?.response?.data?.message || "เกิดข้อผิดพลาดในการเปลี่ยน Lot";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    } finally {
      setChangeLotLoading(false);
    }
  }, [
    ensureAuthenticated,
    focusTrackingInput,
    lotMismatchData,
  ]);

  const lotFilterTabs: ThumbFilterTab[] = useMemo(
    () => [
      { key: "all", label: "ทั้งหมด" },
      { key: "air", label: "✈️ แอร์ (Air)" },
      { key: "sea", label: "🚢 เรือ (Sea)" },
    ],
    [],
  );

  const filteredLots = useMemo(() => {
    return lots.filter((item) => {
      if (lotFilterTab === "air" && item.shippingTypeCode?.toLowerCase() !== "air") {
        return false;
      }
      if (lotFilterTab === "sea" && item.shippingTypeCode?.toLowerCase() !== "sea") {
        return false;
      }
      if (!lotSearch.trim()) return true;
      const q = lotSearch.toLowerCase();
      return (
        item.refLotNo.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.company && item.company.toLowerCase().includes(q))
      );
    });
  }, [lots, lotFilterTab, lotSearch]);

  const modalLotItems: ThumbModalItem[] = useMemo(() => {
    return filteredLots.map((item) => {
      const isAir = item.shippingTypeCode?.toLowerCase() === "air";
      return {
        id: item.mawbUUID,
        title: item.refLotNo,
        subtitle: `Code: ${item.code} | บริษัท: ${item.company || "-"} | วันที่: ${item.createdAt || "-"}`,
        badge: {
          text: item.shippingTypeCode?.toUpperCase() || "AIR",
          variant: isAir ? "blue" : "green",
        },
        selected: selectedLot?.mawbUUID === item.mawbUUID,
      };
    });
  }, [filteredLots, selectedLot]);

  const quickLotChips: QuickChipItem[] = useMemo(() => {
    if (lots.length === 0) return [];
    const chipsLots: LotNo[] = [];

    for (const mawb of recentLotMawbs) {
      const found = lots.find((l) => l.mawbUUID === mawb);
      if (found && !chipsLots.some((l) => l.mawbUUID === found.mawbUUID)) {
        chipsLots.push(found);
      }
    }
    for (const l of lots) {
      if (chipsLots.length >= 4) break;
      if (!chipsLots.some((item) => item.mawbUUID === l.mawbUUID)) {
        chipsLots.push(l);
      }
    }

    return chipsLots.map((l) => ({
      id: l.mawbUUID,
      label: l.refLotNo,
      subLabel: l.code,
      icon: l.shippingTypeCode?.toLowerCase() === "sea" ? "🚢" : "✈️",
      badge: l.shippingTypeCode?.toUpperCase(),
      active: selectedLot?.mawbUUID === l.mawbUUID,
    }));
  }, [lots, recentLotMawbs, selectedLot]);

  const handleSelectLotFromModal = useCallback(
    (item: ThumbModalItem) => {
      const target = lots.find((l) => l.mawbUUID === item.id);
      if (target) handleSelectLot(target);
    },
    [lots, handleSelectLot],
  );

  const handleCloseLotModal = useCallback(() => {
    setShowLotModal(false);
    focusTrackingInput();
  }, [focusTrackingInput]);

  const handleLotMismatchPress = useCallback(
    (item: ScanRecord) => {
      if (selectedLot) {
        setLotMismatchData({
          trackingNo: item.code,
          originalLot: item.originalLot || "",
          newLot: selectedLot,
        });
      } else {
        Alert.alert("แจ้งเตือน", "กรุณาเลือก Lot No. ก่อนเปลี่ยน Lot");
      }
    },
    [selectedLot],
  );

  const renderHistoryItem = useCallback(
    ({ item, index }: { item: ScanRecord; index: number }) => (
      <ReceiveHistoryRow
        item={item}
        scanNumber={history.length - index}
        isLatest={index === 0}
        onLotMismatchPress={handleLotMismatchPress}
      />
    ),
    [handleLotMismatchPress, history.length],
  );

  const historyKeyExtractor = useCallback((item: ScanRecord) => item.id, []);

  return (
    <TouchableWithoutFeedback onPress={focusTrackingInput} accessible={false}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <ScanErrorModal
          kind={scanError}
          onConfirm={confirmScanError}
          onSaveToOffline={
            lastFailedScan ? () => void handleSaveFailedToOffline() : undefined
          }
        />
        <ChangeLotModal
          visible={lotMismatchData !== null}
          trackingNo={lotMismatchData?.trackingNo || ""}
          originalLot={lotMismatchData?.originalLot || ""}
          newLotLabel={
            lotMismatchData
              ? `${lotMismatchData.newLot.refLotNo} | ${lotMismatchData.newLot.createdAt.slice(0, 10)}`
              : ""
          }
          loading={changeLotLoading}
          onCancel={() => {
            setLotMismatchData(null);
            focusTrackingInput();
          }}
          onConfirm={() => void handleConfirmChangeLot()}
        />

        {/* Thumb-friendly Lot Picker Modal */}
        <ThumbSelectionModal
          visible={showLotModal}
          title="เลือก Lot No."
          subtitle="แตะเลือก Lot สำหรับรับเข้าพัสดุ"
          items={modalLotItems}
          searchPlaceholder="ค้นหา Ref Lot, Code หรือบริษัท..."
          searchValue={lotSearch}
          onSearchChange={setLotSearch}
          tabs={lotFilterTabs}
          activeTab={lotFilterTab}
          onTabChange={setLotFilterTab}
          onSelectItem={handleSelectLotFromModal}
          onClose={handleCloseLotModal}
          loading={loadingLots}
        />

        {isScannerTestMode && (
          <View style={styles.testModeBanner}>
            <Text style={styles.testModeBannerText}>
              โหมดทดสอบ — ไม่มีการบันทึกข้อมูล
            </Text>
            <TouchableOpacity
              style={styles.testModeResetBtn}
              onPress={() => void handleResetAllTestData()}
              activeOpacity={0.8}
            >
              <Text style={styles.testModeResetBtnText}>
                🧹 ล้างข้อมูลเทสทั้งหมด
              </Text>
            </TouchableOpacity>
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
              <Text style={styles.compactHeaderTitle}>SHIP2CU Receive</Text>
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

        {/* Productivity Metrics Bar (Shift Tally, Scan Velocity SPM, Lot Count, Sound Booster) */}
        <ProductivityMetricsBar
          totalScans={shiftMetrics.totalScans}
          scanVelocitySpm={scanVelocitySpm}
          currentCategoryLabel={selectedLot ? selectedLot.refLotNo : "เลือก Lot"}
          currentCategoryCount={activeLotCount}
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
            {/* 1. Lot No. Selection with Thumb Ergonomics & Quick Chips */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>1. เลือก Lot No.*</Text>
                {selectedLot && (
                  <View
                    style={[
                      styles.selectedLotBadge,
                      selectedLot.shippingTypeCode?.toLowerCase() === "sea"
                        ? styles.selectedLotBadgeSea
                        : styles.selectedLotBadgeAir,
                    ]}
                  >
                    <Text style={styles.selectedLotBadgeText}>
                      {selectedLot.shippingTypeCode?.toLowerCase() === "sea"
                        ? "🚢 SEA"
                        : "✈️ AIR"}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.customerHeaderRow}>
                <TouchableOpacity
                  style={[
                    styles.selectButton,
                    showLotModal && styles.selectButtonActive,
                    { flex: 1, marginRight: 8 },
                  ]}
                  onPress={() => setShowLotModal(true)}
                  disabled={loadingLots}
                  activeOpacity={0.8}
                >
                  <View style={styles.selectButtonContent}>
                    <Text style={styles.selectButtonLabel}>
                      {(() => {
                        if (loadingLots) return "กำลังโหลดข้อมูล Lot No...";
                        if (selectedLot)
                          return `${selectedLot.refLotNo} | ${selectedLot.createdAt.slice(0, 10)}`;
                        return "กดเพื่อเลือก Lot No.";
                      })()}
                    </Text>
                    {selectedLot && (
                      <Text style={styles.selectButtonDescription}>
                        Code: {selectedLot.code} | {selectedLot.company}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.selectButtonIcon}>▼</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.reloadButton}
                  onPress={() => void loadLots()}
                  disabled={loadingLots}
                  activeOpacity={0.7}
                >
                  <Text style={styles.reloadButtonText}>🔄</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Switch Chips (Thumb Reach Zone) */}
              <QuickChips
                title="⚡ สลับ Lot ด่วน:"
                items={quickLotChips}
                onSelect={(chip) => {
                  const target = lots.find((l) => l.mawbUUID === chip.id);
                  if (!target || target.mawbUUID === selectedLot?.mawbUUID) return;
                  showConfirmDialog({
                    title: "ยืนยันสลับ Lot",
                    message: `ต้องการสลับเครื่องจาก Lot "${selectedLot?.refLotNo || "-"}" ไปเป็น Lot "${target.refLotNo}" ใช่หรือไม่?`,
                    confirmText: "ยืนยันสลับ Lot",
                    cancelText: "ยกเลิก",
                    onConfirm: () => {
                      handleSelectLot(target);
                    },
                  });
                }}
              />
            </View>

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
                    Lot: {selectedLot?.refLotNo}
                  </Text>
                </View>
              ) : (
                <View style={[styles.section, styles.hardwareNotice]}>
                  <Text style={styles.hardwareNoticeTitle}>
                    ⚠️ กรุณาเลือก Lot No.
                  </Text>
                  <Text style={styles.hardwareNoticeText}>
                    เลือก Lot No. ด้านบนก่อนเริ่มสแกน
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
                    placeholder={
                      canScan
                        ? "กรอกหรือสแกน Tracking No."
                        : "เลือก Lot No. ด้านบนก่อนเริ่มสแกน"
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
                    editable={
                      canScan &&
                      !scannedLock &&
                      scanError === null &&
                      lotMismatchData === null
                    }
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
                  ประวัติการสแกน {selectedLot ? `(${selectedLot.refLotNo})` : ""}
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
    color: "#34D399",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#B91C1C",
  },
  testModeBannerText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  testModeResetBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  testModeResetBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B91C1C",
  },
  section: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 0,
  },
  selectedLotBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  selectedLotBadgeAir: {
    backgroundColor: "#DBEAFE",
  },
  selectedLotBadgeSea: {
    backgroundColor: "#D1FAE5",
  },
  selectedLotBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E40AF",
  },
  customerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
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
    borderColor: "#10B981",
    backgroundColor: "#ECFDF5",
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
    color: "#10B981",
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
    backgroundColor: "#ECFDF5",
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
    color: "#10B981",
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
    borderColor: "#10B981",
    borderWidth: 2,
    backgroundColor: "#FFFFFF",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
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
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
  },
  keyboardToggleIcon: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  submitButton: {
    backgroundColor: "#10B981",
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
  historyItemMismatch: {
    backgroundColor: "#FEF2F2",
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
  historyIconMismatch: {
    backgroundColor: "#FEE2E2",
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
  historyBadgeMismatch: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historyBadgeMismatchText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  historyDetails: {
    gap: 2,
  },
  mismatchDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  originalLotText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#DC2626",
  },
  changeLotBtn: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  changeLotBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  historyLotText: {
    fontSize: 13,
    color: "#065F46",
    fontWeight: "500",
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
