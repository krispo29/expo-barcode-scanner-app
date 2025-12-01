import axios from "axios";
import { StatusBar } from "expo-status-bar";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type LotMawb = { id: string; code: string; description?: string };
type Customer = { id: string; name: string; description?: string };
type Destination = { id: string; country: string; code: string };

type ScanRecord = {
  id: string;
  lotMawbId: string;
  customerId: string;
  destinationId: string;
  code: string;
  scannedAt: string;
  mode: "auto" | "manual";
};

const LOT_MAWBS: LotMawb[] = [
  { id: "LOT001", code: "LOT-2024-001", description: "Lot งานเดือนมกราคม" },
  { id: "LOT002", code: "LOT-2024-002", description: "Lot งานเดือนกุมภาพันธ์" },
  { id: "MAWB001", code: "MAWB-TH-001", description: "MAWB เที่ยวบินเช้า" },
  { id: "MAWB002", code: "MAWB-TH-002", description: "MAWB เที่ยวบินบ่าย" },
];

const CUSTOMERS: Customer[] = [
  { id: "HPC0222", name: "HPC0222", description: "ลูกค้าในตัวอย่างเอกสาร" },
  { id: "HEYNATURE", name: "Heynature", description: "ทดสอบสำหรับ shipment" },
  { id: "ACME", name: "ACME Co.", description: "ลูกค้าสมมติ" },
];

const DESTINATIONS: Destination[] = [
  { id: "TH", country: "ประเทศไทย", code: "TH" },
  { id: "US", country: "สหรัฐอเมริกา", code: "US" },
  { id: "JP", country: "ญี่ปุ่น", code: "JP" },
  { id: "CN", country: "จีน", code: "CN" },
  { id: "KR", country: "เกาหลีใต้", code: "KR" },
  { id: "SG", country: "สิงคโปร์", code: "SG" },
];

export default function IndexScreen() {
  const insets = useSafeAreaInsets();

  // Step 1: Lot/MAWB Selection
  const [lotMawb, setLotMawb] = useState<LotMawb | null>(null);
  
  // Step 2: Customer Selection
  const [customer, setCustomer] = useState<Customer | null>(null);
  
  // Step 3: Destination Selection
  const [destination, setDestination] = useState<Destination | null>(null);

  const [autoEnter, setAutoEnter] = useState(true);
  const [input, setInput] = useState("");
  const [scannedLock, setScannedLock] = useState(false);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [lastStatus, setLastStatus] = useState<string>("-");
  const [historyFullScreen, setHistoryFullScreen] = useState(false);
  
  // Check if all steps are completed
  const canScan = lotMawb !== null && customer !== null && destination !== null;

  // Dropdown states
  const [showLotDropdown, setShowLotDropdown] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showDestinationDropdown, setShowDestinationDropdown] = useState(false);

  // Search states
  const [lotSearch, setLotSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [destinationSearch, setDestinationSearch] = useState("");

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

        const historyIndex = history.findIndex(
          (record) => record.id === item.id
        );
        const displayOrder =
          historyIndex >= 0 ? history.length - historyIndex : 0;
        const isLatest = historyIndex === 0;
        
        const lotMawbData = LOT_MAWBS.find((l) => l.id === item.lotMawbId);
        const customerData = CUSTOMERS.find((c) => c.id === item.customerId);
        const destinationData = DESTINATIONS.find((d) => d.id === item.destinationId);

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
                  📦 {lotMawbData?.code || item.lotMawbId}
                </Text>
                <Text style={styles.historyCustomer}>
                  👤 {customerData?.name || item.customerId}
                </Text>
                <Text style={styles.historyCustomer}>
                  🌍 {destinationData?.country || item.destinationId}
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
    setHistoryFullScreen(true);
  }, []);

  const closeHistoryFullScreen = useCallback(() => {
    setHistoryFullScreen(false);
  }, []);

  // Filter functions
  const filteredLotMawbs = LOT_MAWBS.filter(
    (item) =>
      item.code.toLowerCase().includes(lotSearch.toLowerCase()) ||
      item.description?.toLowerCase().includes(lotSearch.toLowerCase())
  );

  const filteredCustomers = CUSTOMERS.filter(
    (item) =>
      item.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      item.description?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const filteredDestinations = DESTINATIONS.filter(
    (item) =>
      item.country.toLowerCase().includes(destinationSearch.toLowerCase()) ||
      item.code.toLowerCase().includes(destinationSearch.toLowerCase())
  );

  const visibleHistory = history.slice(0, 10);
  const showingAllHistory = history.length <= 10;

  const handleDetected = useCallback(
    async (rawValue: string, mode: "auto" | "manual") => {
      // Check if all steps are completed
      if (!canScan || !lotMawb || !customer || !destination) {
        Alert.alert(
          "กรุณาเลือกข้อมูลให้ครบ",
          "กรุณาเลือก Lot/MAWB, ลูกค้า และประเทศปลายทางก่อนสแกน"
        );
        return;
      }

      const normalized = normalizeTracking(rawValue);
      if (!normalized) {
        Alert.alert(
          "ไม่พบ Tracking No.",
          "ข้อมูลที่ได้ว่างเปล่าหรือไม่ใช่ตัวเลข/ตัวอักษร"
        );
        return;
      }

      const now = Date.now();
      const { value: lastValue, timestamp: lastTimestamp } = lastScanRef.current;

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

        await fakeSubmit({
          lotMawbId: lotMawb.id,
          customerId: customer.id,
          destinationId: destination.id,
          trackingNo: normalized,
          mode,
        });

        idCounter.current += 1;
        const record: ScanRecord = {
          id: `${Date.now()}-${idCounter.current}`,
          lotMawbId: lotMawb.id,
          customerId: customer.id,
          destinationId: destination.id,
          code: normalized,
          scannedAt: new Date().toISOString(),
          mode,
        };

        setHistory((prev) => [record, ...prev].slice(0, 30));
        setLastStatus(`${normalized} • ${customer.name} • ${destination.country}`);
        setInput(""); // เคลียร์ค่าเก่าหลังสแกนสำเร็จ
      } catch (error: any) {
        Alert.alert("บันทึกไม่สำเร็จ", error?.message ?? String(error));
      } finally {
        if (unlockTimer.current) clearTimeout(unlockTimer.current);
        unlockTimer.current = setTimeout(() => setScannedLock(false), 900);
      }
    },
    [canScan, lotMawb, customer, destination, scannedLock]
  );

  // ใช้กับสแกนเนอร์ฮาร์ดแวร์ (RS51 ยิงแล้วส่งตัวอักษร + Enter เข้ามา)
  const handleInputChange = useCallback(
    (text: string) => {
      if (autoEnter && /[\r\n]/.test(text)) {
        const sanitized = text.replaceAll(/[\r\n]/g, "");
        setInput(sanitized);
        if (sanitized.trim()) {
          handleDetected(sanitized, "auto");
        }
        return;
      }
      setInput(text);
    },
    [autoEnter, handleDetected]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>RS51 Scanner</Text>
          <Text style={styles.headerSubtitle}>
            โหมดสแกนเนอร์ฮาร์ดแวร์ (1D/2D)
          </Text>
        </View>
        <View style={styles.headerActions} />
      </View>

      {/* Bottom Panel (Scrollable) */}
      <View
        style={[
          styles.controlsPanel,
          { paddingBottom: insets.bottom + 20, flex: 1 },
        ]}
      >
        <View style={styles.panelHandleWrapper}>
          <View style={styles.panelHandle} />
          <Text style={styles.panelHandleText}>
            เลื่อนขึ้น-ลงเพื่อดูข้อมูลและประวัติการสแกน
          </Text>
        </View>

        <ScrollView
          style={styles.controlsScroll}
          contentContainerStyle={styles.controlsScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step Progress Indicator */}
          <View style={styles.stepProgress}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, lotMawb && styles.stepCircleActive]}>
                <Text style={[styles.stepNumber, lotMawb && styles.stepNumberActive]}>1</Text>
              </View>
              <Text style={[styles.stepLabel, lotMawb && styles.stepLabelActive]}>
                Lot/MAWB
              </Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, customer && styles.stepCircleActive]}>
                <Text style={[styles.stepNumber, customer && styles.stepNumberActive]}>2</Text>
              </View>
              <Text style={[styles.stepLabel, customer && styles.stepLabelActive]}>
                ลูกค้า
              </Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, destination && styles.stepCircleActive]}>
                <Text style={[styles.stepNumber, destination && styles.stepNumberActive]}>3</Text>
              </View>
              <Text style={[styles.stepLabel, destination && styles.stepLabelActive]}>
                ปลายทาง
              </Text>
            </View>
          </View>

          {/* Step 1: Lot/MAWB Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. เลือก Lot/MAWB</Text>
            <View>
              <TouchableOpacity
                style={[styles.selectButton, showLotDropdown && styles.selectButtonActive]}
                onPress={() => {
                  setShowLotDropdown(!showLotDropdown);
                  setShowCustomerDropdown(false);
                  setShowDestinationDropdown(false);
                }}
              >
                <View style={styles.selectButtonContent}>
                  <Text style={styles.selectButtonLabel}>
                    {lotMawb ? lotMawb.code : "กดเพื่อเลือก Lot/MAWB"}
                  </Text>
                  {lotMawb && (
                    <Text style={styles.selectButtonDescription}>
                      {lotMawb.description}
                    </Text>
                  )}
                </View>
                <Text style={[styles.selectButtonIcon, showLotDropdown && styles.selectButtonIconActive]}>
                  {showLotDropdown ? "▲" : "▼"}
                </Text>
              </TouchableOpacity>

              {showLotDropdown && (
                <View style={styles.dropdown}>
                  <View style={styles.searchContainer}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                      value={lotSearch}
                      onChangeText={setLotSearch}
                      placeholder="ค้นหา Lot/MAWB..."
                      style={styles.searchInput}
                      placeholderTextColor="#9CA3AF"
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

                  <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                    {filteredLotMawbs.length === 0 ? (
                      <View style={styles.emptySearch}>
                        <Text style={styles.emptySearchText}>ไม่พบข้อมูล</Text>
                      </View>
                    ) : (
                      filteredLotMawbs.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.dropdownItem,
                            lotMawb?.id === item.id && styles.dropdownItemActive,
                          ]}
                          onPress={() => {
                            setLotMawb(item);
                            setShowLotDropdown(false);
                            setLotSearch("");
                          }}
                        >
                          <View style={styles.dropdownItemContent}>
                            <Text style={styles.dropdownItemTitle}>{item.code}</Text>
                            {item.description && (
                              <Text style={styles.dropdownItemDescription}>
                                {item.description}
                              </Text>
                            )}
                          </View>
                          {lotMawb?.id === item.id && (
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

          {/* Step 2: Customer Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. เลือกลูกค้า</Text>
            <View>
              <TouchableOpacity
                style={[styles.selectButton, showCustomerDropdown && styles.selectButtonActive]}
                onPress={() => {
                  setShowCustomerDropdown(!showCustomerDropdown);
                  setShowLotDropdown(false);
                  setShowDestinationDropdown(false);
                }}
              >
                <View style={styles.selectButtonContent}>
                  <Text style={styles.selectButtonLabel}>
                    {customer ? customer.name : "กดเพื่อเลือกลูกค้า"}
                  </Text>
                  {customer && (
                    <Text style={styles.selectButtonDescription}>
                      {customer.description}
                    </Text>
                  )}
                </View>
                <Text style={[styles.selectButtonIcon, showCustomerDropdown && styles.selectButtonIconActive]}>
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
                      placeholder="ค้นหาลูกค้า..."
                      style={styles.searchInput}
                      placeholderTextColor="#9CA3AF"
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

                  <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                    {filteredCustomers.length === 0 ? (
                      <View style={styles.emptySearch}>
                        <Text style={styles.emptySearchText}>ไม่พบข้อมูล</Text>
                      </View>
                    ) : (
                      filteredCustomers.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.dropdownItem,
                            customer?.id === item.id && styles.dropdownItemActive,
                          ]}
                          onPress={() => {
                            setCustomer(item);
                            setShowCustomerDropdown(false);
                            setCustomerSearch("");
                          }}
                        >
                          <View style={styles.dropdownItemContent}>
                            <Text style={styles.dropdownItemTitle}>{item.name}</Text>
                            {item.description && (
                              <Text style={styles.dropdownItemDescription}>
                                {item.description}
                              </Text>
                            )}
                          </View>
                          {customer?.id === item.id && (
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

          {/* Step 3: Destination Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Released - เลือกประเทศปลายทาง</Text>
            <View>
              <TouchableOpacity
                style={[styles.selectButton, showDestinationDropdown && styles.selectButtonActive]}
                onPress={() => {
                  setShowDestinationDropdown(!showDestinationDropdown);
                  setShowLotDropdown(false);
                  setShowCustomerDropdown(false);
                }}
              >
                <View style={styles.selectButtonContent}>
                  <Text style={styles.selectButtonLabel}>
                    {destination ? `${destination.code} - ${destination.country}` : "กดเพื่อเลือกประเทศปลายทาง"}
                  </Text>
                </View>
                <Text style={[styles.selectButtonIcon, showDestinationDropdown && styles.selectButtonIconActive]}>
                  {showDestinationDropdown ? "▲" : "▼"}
                </Text>
              </TouchableOpacity>

              {showDestinationDropdown && (
                <View style={styles.dropdown}>
                  <View style={styles.searchContainer}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                      value={destinationSearch}
                      onChangeText={setDestinationSearch}
                      placeholder="ค้นหาประเทศ..."
                      style={styles.searchInput}
                      placeholderTextColor="#9CA3AF"
                    />
                    {destinationSearch.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setDestinationSearch("")}
                        style={styles.searchClear}
                      >
                        <Text style={styles.searchClearText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                    {filteredDestinations.length === 0 ? (
                      <View style={styles.emptySearch}>
                        <Text style={styles.emptySearchText}>ไม่พบข้อมูล</Text>
                      </View>
                    ) : (
                      filteredDestinations.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.dropdownItem,
                            destination?.id === item.id && styles.dropdownItemActive,
                          ]}
                          onPress={() => {
                            setDestination(item);
                            setShowDestinationDropdown(false);
                            setDestinationSearch("");
                          }}
                        >
                          <View style={styles.dropdownItemContent}>
                            <Text style={styles.dropdownItemTitle}>
                              {item.code} - {item.country}
                            </Text>
                          </View>
                          {destination?.id === item.id && (
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
              <Text style={styles.readyNoticeTitle}>
                ✅ พร้อมสแกนบาร์โค้ด
              </Text>
              <Text style={styles.readyNoticeText}>
                คุณได้เลือกข้อมูลครบถ้วนแล้ว สามารถเริ่มสแกนบาร์โค้ดได้
              </Text>
            </View>
          ) : (
            <View style={[styles.section, styles.hardwareNotice]}>
              <Text style={styles.hardwareNoticeTitle}>
                ⚠️ กรุณาเลือกข้อมูลให้ครบก่อนสแกน
              </Text>
              <Text style={styles.hardwareNoticeText}>
                กรุณาเลือก Lot/MAWB, ลูกค้า และประเทศปลายทางให้ครบทั้ง 3 ขั้นตอน
                ก่อนที่จะสามารถสแกนบาร์โค้ดได้
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
                  placeholder={canScan ? "กรอกหรือสแกน Tracking No." : "เลือกข้อมูลก่อนสแกน"}
                  style={[styles.trackingInput, !canScan && styles.trackingInputDisabled]}
                  keyboardType="default"
                  returnKeyType="done"
                  placeholderTextColor="#9CA3AF"
                  autoCorrect={false}
                  editable={canScan}
                  onSubmitEditing={() => {
                    if (!autoEnter || !canScan) return;
                    const trimmed = input.trim();
                    if (!trimmed) return;
                    handleDetected(trimmed, "auto");
                  }}
                />
                {!autoEnter && (
                  <TouchableOpacity
                    onPress={() => handleDetected(input, "manual")}
                    style={[
                      styles.submitButton,
                      (!input.trim() || !canScan) && styles.submitButtonDisabled,
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
                  เริ่มสแกนบาร์โค้ดด้วย RS51 เพื่อดูประวัติที่นี่
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
        </ScrollView>
      </View>

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
              <Text style={styles.emptyHistoryText}>
                ยังไม่มีประวัติการสแกน
              </Text>
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

type SubmitPayload = {
  lotMawbId: string;
  customerId: string;
  destinationId: string;
  trackingNo: string;
  mode: "auto" | "manual";
};

async function fakeSubmit(payload: SubmitPayload) {
  // Log ข้อมูลที่จะส่งไป API
  console.log("=== ข้อมูลที่จะส่งไป API ===");
  console.log("Lot/MAWB ID:", payload.lotMawbId);
  console.log("Customer ID:", payload.customerId);
  console.log("Destination ID:", payload.destinationId);
  console.log("Tracking No:", payload.trackingNo);
  console.log("Mode:", payload.mode);
  console.log("Timestamp:", new Date().toISOString());
  console.log("Full Payload:", JSON.stringify(payload, null, 2));
  console.log("=============================");

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300));
  return true;
}

// ตัวอย่าง function สำหรับ call API POST จริงด้วย axios
async function submitToAPI(payload: SubmitPayload) {
  const API_URL = "https://your-api-endpoint.com/api/scan"; // เปลี่ยน URL ตามจริง
  
  // สร้าง request body
  const requestData = {
    lotMawbId: payload.lotMawbId,
    customerId: payload.customerId,
    destinationId: payload.destinationId,
    trackingNo: payload.trackingNo,
    mode: payload.mode,
    scannedAt: new Date().toISOString(),
  };

  // Log ข้อมูลก่อนส่ง
  console.log("=== กำลังส่งข้อมูลไป API (Axios) ===");
  console.log("URL:", API_URL);
  console.log("Method: POST");
  console.log("Request Data:", JSON.stringify(requestData, null, 2));
  
  try {
    const response = await axios.post(API_URL, requestData, {
      headers: {
        "Content-Type": "application/json",
        // เพิ่ม headers อื่นๆ ตามต้องการ เช่น Authorization
        // "Authorization": "Bearer YOUR_TOKEN_HERE",
      },
      timeout: 10000, // timeout 10 วินาที
    });

    // Log response
    console.log("Response Status:", response.status);
    console.log("Response Headers:", JSON.stringify(response.headers, null, 2));
    console.log("Response Data:", JSON.stringify(response.data, null, 2));
    console.log("========================================");
    
    return response.data;
  } catch (error: any) {
    console.error("=== API Call Failed (Axios) ===");
    
    // ตรวจสอบว่าเป็น Axios Error หรือไม่
    if (error.response) {
      // Server ตอบกลับมาแต่ status code ไม่ใช่ 2xx
      console.error("Response Status:", error.response.status);
      console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
      console.error("Response Headers:", JSON.stringify(error.response.headers, null, 2));
      throw new Error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      // Request ถูกส่งไปแล้วแต่ไม่ได้รับ response
      console.error("No Response Received");
      console.error("Request:", error.request);
      throw new Error("ไม่สามารถเชื่อมต่อกับ API ได้");
    } else if (error.message) {
      // เกิด error ตอนสร้าง request
      console.error("Request Setup Error:", error.message);
      throw new Error(`Request Error: ${error.message}`);
    } else {
      // Error อื่นๆ
      console.error("Unknown Error:", error);
      throw new Error(String(error));
    }
  }
}

function normalizeTracking(value: string) {
  const onlyDigits = value.replaceAll(/[^0-9A-Za-z]/g, "");
  return onlyDigits.trim().toUpperCase();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "rgba(0,0,0,0.9)",
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
  headerSubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },

  // Controls Panel
  controlsPanel: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 16,
    paddingHorizontal: 20,
    width: "100%",
  },
  panelHandleWrapper: {
    alignItems: "center",
    paddingVertical: 4,
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
  controlsScroll: {
    flex: 1,
  },
  controlsScrollContent: {
    paddingBottom: 16,
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

  hardwareNotice: {
    backgroundColor: "rgba(59,130,246,0.1)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.35)",
  },
  hardwareNoticeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1D4ED8",
    marginBottom: 8,
  },
  hardwareNoticeText: {
    fontSize: 14,
    color: "#1F2937",
    lineHeight: 20,
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
    marginBottom: 0,
  },
  historyListWrapper: {
    maxHeight: 320,
  },
  historyScroll: {
    flexGrow: 0,
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

  // Step Progress
  stepProgress: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 20,
    marginBottom: 24,
  },
  stepItem: {
    alignItems: "center",
    gap: 8,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#D1D5DB",
  },
  stepCircleActive: {
    backgroundColor: "#3B82F6",
    borderColor: "#2563EB",
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  stepNumberActive: {
    color: "#FFFFFF",
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  stepLabelActive: {
    color: "#3B82F6",
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 8,
  },

  // Destination Grid
  destinationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  destinationCard: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    minWidth: "30%",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  destinationCardActive: {
    backgroundColor: "#EBF4FF",
    borderColor: "#3B82F6",
  },
  destinationCode: {
    fontSize: 18,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 4,
  },
  destinationCodeActive: {
    color: "#1D4ED8",
  },
  destinationCountry: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  destinationCountryActive: {
    color: "#3B82F6",
  },

  // Ready Notice
  readyNotice: {
    backgroundColor: "rgba(16,185,129,0.1)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.35)",
  },
  readyNoticeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#059669",
    marginBottom: 8,
  },
  readyNoticeText: {
    fontSize: 14,
    color: "#1F2937",
    lineHeight: 20,
  },

  // Disabled Input
  trackingInputDisabled: {
    backgroundColor: "#F3F4F6",
    color: "#9CA3AF",
  },

  // Select Button
  selectButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectButtonActive: {
    borderColor: "#3B82F6",
    backgroundColor: "#F0F9FF",
  },
  selectButtonContent: {
    flex: 1,
  },
  selectButtonLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  selectButtonDescription: {
    fontSize: 13,
    color: "#6B7280",
  },
  selectButtonIcon: {
    fontSize: 14,
    color: "#9CA3AF",
    marginLeft: 12,
  },
  selectButtonIconActive: {
    color: "#3B82F6",
  },

  // Dropdown
  dropdown: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 2,
    borderColor: "#3B82F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    maxHeight: 320,
  },
  dropdownList: {
    maxHeight: 240,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  dropdownItemActive: {
    backgroundColor: "#EBF4FF",
  },
  dropdownItemContent: {
    flex: 1,
  },
  dropdownItemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  dropdownItemDescription: {
    fontSize: 12,
    color: "#6B7280",
  },
  dropdownItemCheck: {
    fontSize: 20,
    color: "#3B82F6",
    fontWeight: "700",
    marginLeft: 12,
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    margin: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
    padding: 0,
  },
  searchClear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  searchClearText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },

  emptySearch: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptySearchText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "500",
  },
});
