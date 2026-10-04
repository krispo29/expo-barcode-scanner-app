import AsyncStorage from "@react-native-async-storage/async-storage";
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
import {
  classifyScanError,
  getScanErrorMessage,
  ScanErrorKind,
  ScanErrorModal,
} from "../components/ScanErrorModal";
import {
  ChangeLotModal,
  extractOriginalLot,
  isLotMismatchError,
} from "../components/ChangeLotModal";
import { clearStoredAuth, getValidAccessToken } from "../../utils/auth";
import api from "../../utils/api";
import {
  getScannerTestOutcome,
  isScannerTestMode,
  LotNo,
  TEST_LOTS,
} from "../../utils/scannerTestMode";

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
  const [showLotDropdown, setShowLotDropdown] = useState(false);
  const [lotSearch, setLotSearch] = useState("");

  // Change Lot Modal states
  const [lotMismatchData, setLotMismatchData] = useState<{
    trackingNo: string;
    originalLot: string;
    newLot: LotNo;
  } | null>(null);
  const [changeLotLoading, setChangeLotLoading] = useState(false);

  // Check if ready to scan
  const canScan = selectedLot !== null;

  const [autoEnter, setAutoEnter] = useState(true);
  const [input, setInput] = useState("");
  const [scannedLock, setScannedLock] = useState(false);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [lastStatus, setLastStatus] = useState<string>("-");
  const [scanError, setScanError] = useState<ScanErrorKind | null>(null);

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

    void loadSounds();

    return () => {
      soundAir?.unloadAsync();
      soundSea?.unloadAsync();
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
    setTimeout(() => inputRef.current?.focus(), 150);
  }, []);

  // โฟกัสช่อง Tracking Number อัตโนมัติเมื่อเลือก Lot แล้ว และ dropdown ปิด
  useEffect(() => {
    if (selectedLot && !showLotDropdown && inputRef.current) {
      focusTrackingInput();
    }
  }, [focusTrackingInput, selectedLot, showLotDropdown]);

  // เคลียร์ timer ตอน unmount
  useEffect(() => {
    return () => {
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isScannerTestMode) void ensureAuthenticated();
  }, [ensureAuthenticated]);

  const loadLots = useCallback(async () => {
    if (isScannerTestMode) {
      setLots(TEST_LOTS);
      setSelectedLot((prev) => prev || TEST_LOTS[0]);
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
        void loadLots();
      }
    }, [ensureAuthenticated, loadLots]),
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
      setShowLotDropdown(false);
      void AsyncStorage.setItem("@selected_lot_mawb", lot.mawbUUID);
      focusTrackingInput();
    },
    [focusTrackingInput],
  );

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
      clearAutoSubmitTimer();
      latestInputRef.current = "";
      setInput("");
      inputRef.current?.blur();
      setScanError(kind);
    },
    [clearAutoSubmitTimer],
  );

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
        await playErrorSound("notFound");
        return;
      }

      const isDuplicate = scannedCodesRef.current.has(normalized);
      if (isDuplicate) {
        setLastStatus(`${normalized} • สแกนซ้ำในเครื่องนี้`);
        showScanError("duplicate");
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
        void playErrorSound("generic");

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
        setHistory((prev) =>
          [record, ...prev.filter((r) => r.code !== trackingNo)].slice(0, 30),
        );
        setLastStatus(
          `${trackingNo} • Lot ไม่ตรง (${originalLot || "ไม่ระบุ"})`,
        );

        latestInputRef.current = "";
        setInput("");
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
            triggerLotMismatch(
              normalized,
              "LOT_NO_NOT_MATCH:TEST-LOT-RECEIVE-001",
            );
            return;
          }

          if (outcome !== "success") {
            const errorKind = outcome === "invalid" ? "generic" : "system";
            setLastStatus(`${normalized} • ${getScanErrorMessage(errorKind)}`);
            modalOpened = true;
            showScanError(errorKind);
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
          setHistory((prev) => [record, ...prev].slice(0, 30));
          setLastStatus(`${normalized} • ${shippingType.toUpperCase()}`);
          latestInputRef.current = "";
          setInput("");
          if (shippingType === "sea" && soundSea) {
            await soundSea.replayAsync();
          } else if (soundAir) {
            await soundAir.replayAsync();
          }
          return;
        }

        try {
          Vibration.vibrate(Platform.OS === "android" ? 30 : 200);
        } catch {
          // ignore
        }

        console.log("=== Scan Request ===");
        console.log("Tracking No:", normalized);
        console.log("MawbUUID:", selectedLot.mawbUUID);

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

        console.log("=== Scan Response ===", response.data);

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
          setHistory((prev) => [record, ...prev].slice(0, 30));
          setLastStatus(`${normalized} • ${shippingType.toUpperCase()}`);
          latestInputRef.current = "";
          setInput("");

          try {
            if (shippingType === "sea" && soundSea) {
              await soundSea.replayAsync();
            } else if (soundAir) {
              await soundAir.replayAsync();
            }
          } catch (err) {
            console.log("Error playing sound", err);
          }
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
          modalOpened = true;
          showScanError(errorKind);
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

        const status = Number(error?.response?.status);
        const systemFailure =
          !error?.response || status === 401 || status === 403 || status >= 500;
        const errorKind = classifyScanError(
          errorMessage,
          errorCode,
          systemFailure,
        );
        setLastStatus(`${normalized} • ${getScanErrorMessage(errorKind)}`);
        modalOpened = true;
        showScanError(errorKind);
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
      playErrorSound,
      selectedLot,
      showScanError,
      soundAir,
      soundSea,
    ],
  );

  const handleConfirmChangeLot = useCallback(async () => {
    if (!lotMismatchData) return;
    const { trackingNo, newLot } = lotMismatchData;
    setChangeLotLoading(true);

    try {
      if (isScannerTestMode) {
        setLotMismatchData(null);
        scannedCodesRef.current.add(trackingNo);
        setHistory((prev) =>
          prev.map((item) =>
            item.code === trackingNo
              ? { ...item, status: "success", targetLot: newLot.refLotNo }
              : item,
          ),
        );
        setLastStatus(
          `${trackingNo} • เปลี่ยน Lot สำเร็จ (${newLot.refLotNo})`,
        );
        if (soundAir) await soundAir.replayAsync();
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
        setHistory((prev) =>
          prev.map((item) =>
            item.code === trackingNo
              ? {
                  ...item,
                  status: "success",
                  targetLot: newLot.refLotNo,
                  shippingType,
                }
              : item,
          ),
        );
        setLastStatus(
          `${trackingNo} • เปลี่ยน Lot สำเร็จ (${newLot.refLotNo})`,
        );
        if (shippingType === "sea" && soundSea) {
          await soundSea.replayAsync();
        } else if (soundAir) {
          await soundAir.replayAsync();
        }
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
    soundAir,
    soundSea,
  ]);

  // ใช้กับสแกนเนอร์ฮาร์ดแวร์ (RS51 ยิงแล้วส่งตัวอักษร + Enter เข้ามา)
  const handleInputChange = useCallback(
    (text: string) => {
      if (
        scanInFlightRef.current ||
        scanError !== null ||
        lotMismatchData !== null
      )
        return;

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
    [
      autoEnter,
      clearAutoSubmitTimer,
      handleDetected,
      lotMismatchData,
      scanError,
    ],
  );

  const handleManualSubmit = () => {
    const trackingNumber = latestInputRef.current;
    if (!trackingNumber.trim() || !canScan) return;
    clearAutoSubmitTimer();
    void handleDetected(trackingNumber, autoEnter ? "auto" : "manual");
  };

  const filteredLots = lots.filter(
    (item) =>
      item.refLotNo.toLowerCase().includes(lotSearch.toLowerCase()) ||
      item.code.toLowerCase().includes(lotSearch.toLowerCase()) ||
      (item.company &&
        item.company.toLowerCase().includes(lotSearch.toLowerCase())),
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <ScanErrorModal kind={scanError} onConfirm={confirmScanError} />
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

      {isScannerTestMode && (
        <View style={styles.testModeBanner}>
          <Text style={styles.testModeBannerText}>
            โหมดทดสอบ — ไม่มีการบันทึกข้อมูล
          </Text>
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
          {/* 1. Lot No. Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. เลือก Lot No.*</Text>
            <View>
              <View style={styles.customerHeaderRow}>
                <TouchableOpacity
                  style={[
                    styles.selectButton,
                    showLotDropdown && styles.selectButtonActive,
                    { flex: 1, marginRight: 8 },
                  ]}
                  onPress={() => setShowLotDropdown(!showLotDropdown)}
                  disabled={loadingLots}
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
                        Code: {selectedLot.code} |{" "}
                        {selectedLot.shippingTypeCode?.toUpperCase()} |{" "}
                        {selectedLot.company}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.selectButtonIcon,
                      showLotDropdown && styles.selectButtonIconActive,
                    ]}
                  >
                    {showLotDropdown ? "▲" : "▼"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.reloadButton}
                  onPress={() => void loadLots()}
                  disabled={loadingLots}
                >
                  <Text style={styles.reloadButtonText}>🔄</Text>
                </TouchableOpacity>
              </View>

              {showLotDropdown && (
                <View style={styles.dropdown}>
                  <View style={styles.searchContainer}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                      value={lotSearch}
                      onChangeText={setLotSearch}
                      placeholder="ค้นหาด้วย Ref Lot No. หรือ Code..."
                      style={styles.searchInput}
                      placeholderTextColor="#9CA3AF"
                      autoFocus={true}
                    />
                    {lotSearch.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setLotSearch("")}
                        style={styles.searchClear}
                      >
                        <Text style={styles.searchClearText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.dropdownHeader}>
                    <Text style={styles.dropdownHeaderText}>
                      {lotSearch.length > 0
                        ? `พบ ${filteredLots.length} รายการ`
                        : `ทั้งหมด ${lots.length} รายการ`}
                    </Text>
                  </View>

                  <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                    {filteredLots.length === 0 ? (
                      <View style={styles.emptySearch}>
                        <Text style={styles.emptySearchIcon}>🔍</Text>
                        <Text style={styles.emptySearchText}>
                          ไม่พบข้อมูล Lot No.
                        </Text>
                        <Text style={styles.emptySearchHint}>
                          ลองค้นหาด้วยคำอื่น หรือกดปุ่ม 🔄 เพื่อโหลดใหม่
                        </Text>
                      </View>
                    ) : (
                      filteredLots.map((item) => {
                        const isSelected =
                          selectedLot?.mawbUUID === item.mawbUUID;
                        return (
                          <TouchableOpacity
                            key={item.mawbUUID}
                            style={[
                              styles.dropdownItem,
                              isSelected && styles.dropdownItemActive,
                            ]}
                            onPress={() => handleSelectLot(item)}
                          >
                            <View style={styles.dropdownItemContent}>
                              <Text style={styles.dropdownItemTitle}>
                                {item.refLotNo}
                              </Text>
                              <Text style={styles.dropdownItemDescription}>
                                {item.code} |{" "}
                                {item.shippingTypeCode?.toUpperCase()} |{" "}
                                {item.createdAt}
                              </Text>
                            </View>
                            {isSelected && (
                              <Text style={styles.dropdownItemCheck}>✓</Text>
                            )}
                          </TouchableOpacity>
                        );
                      })
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
                    !canScan && styles.trackingInputDisabled,
                  ]}
                  keyboardType="default"
                  returnKeyType="done"
                  placeholderTextColor="#9CA3AF"
                  autoCorrect={false}
                  editable={
                    canScan &&
                    !scannedLock &&
                    scanError === null &&
                    lotMismatchData === null
                  }
                  submitBehavior="submit"
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
              <ScrollView
                style={styles.historyScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {history.map((item, index) => {
                  const scanTime = new Date(item.scannedAt);
                  const isLatest = index === 0;
                  const isMismatch = item.status === "lot_mismatch";

                  return (
                    <View
                      key={item.id}
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
                          <Text style={styles.historyNumberText}>
                            #{history.length - index}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.historyContent}>
                        <View style={styles.historyHeader}>
                          <Text style={styles.historyCode}>{item.code}</Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            {isMismatch ? (
                              <View style={styles.historyBadgeMismatch}>
                                <Text style={styles.historyBadgeMismatchText}>
                                  Lot ไม่ตรง
                                </Text>
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
                                onPress={() => {
                                  if (selectedLot) {
                                    setLotMismatchData({
                                      trackingNo: item.code,
                                      originalLot: item.originalLot || "",
                                      newLot: selectedLot,
                                    });
                                  } else {
                                    Alert.alert(
                                      "แจ้งเตือน",
                                      "กรุณาเลือก Lot No. ก่อนเปลี่ยน Lot",
                                    );
                                  }
                                }}
                              >
                                <Text style={styles.changeLotBtnText}>
                                  เปลี่ยน Lot
                                </Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <Text style={styles.historyLotText}>
                              Lot:{" "}
                              {item.targetLot || selectedLot?.refLotNo || "-"}
                            </Text>
                          )}
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
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
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
});
