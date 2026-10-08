import React from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export const isLotMismatchError = (message?: string): boolean => {
  return typeof message === "string" && message.includes("LOT_NO_NOT_MATCH");
};

export const extractOriginalLot = (message?: string): string => {
  if (!message || typeof message !== "string") return "";
  const prefix = "LOT_NO_NOT_MATCH:";
  const index = message.indexOf(prefix);
  if (index !== -1) {
    return message.substring(index + prefix.length).trim();
  }
  return "";
};

export type MinimalLot = {
  code: string;
  refLotNo: string;
  [key: string]: any;
};

export const findLotByCodeOrRef = <T extends MinimalLot>(
  lots: T[],
  query?: string,
): T | undefined => {
  if (!query || typeof query !== "string") return undefined;
  const clean = query.trim().toLowerCase();
  return lots.find(
    (lot) =>
      lot.refLotNo.toLowerCase() === clean || lot.code.toLowerCase() === clean,
  );
};

export type ChangeLotModalProps = {
  visible: boolean;
  trackingNo: string;
  originalLot: string;
  newLotLabel: string;
  loading?: boolean;
  canSwitchToOriginal?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onSwitchToOriginalLot?: () => void;
};

export const ChangeLotModal = React.memo(function ChangeLotModal({
  visible,
  trackingNo,
  originalLot,
  newLotLabel,
  loading = false,
  canSwitchToOriginal = false,
  onCancel,
  onConfirm,
  onSwitchToOriginalLot,
}: ChangeLotModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View accessibilityRole="alert" style={styles.card}>
          <Text style={styles.title}>
            แจ้งเตือน: Lot ไม่ตรงกับที่เลือก
          </Text>
          <Text style={styles.subtitle}>
            พัสดุนี้ผูกอยู่กับ Lot เดิม ต้องการย้ายพัสดุเข้า Lot นี้ หรือปิดหน้าต่างเพื่อเลือก Lot ใหม่?
          </Text>

          <View style={styles.detailBox}>
            <View style={styles.row}>
              <Text style={styles.label}>Tracking No.: </Text>
              <Text style={styles.trackingText}>{trackingNo}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Lot เดิมของพัสดุ: </Text>
              <View style={styles.badgeOriginal}>
                <Text style={styles.badgeOriginalText}>
                  {originalLot || "ไม่ระบุ"}
                </Text>
              </View>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Lot ปัจจุบันของเครื่อง: </Text>
              <View style={styles.badgeNew}>
                <Text style={styles.badgeNewText}>{newLotLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.actionsContainer}>

            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.button, styles.confirmButton]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.confirmButtonText}>
                    📦 ย้ายพัสดุเข้า Lot นี้ ({newLotLabel.split("|")[0].trim()})
                  </Text>
                  <Text style={styles.confirmButtonHint}>
                    เปลี่ยนรหัส Lot ของพัสดุในระบบ
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>ยกเลิก / ปิดหน้าต่าง</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 16,
    lineHeight: 18,
  },
  detailBox: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 14,
    backgroundColor: "#F8FAFC",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginVertical: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  trackingText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#D97706",
  },
  badgeOriginal: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeOriginalText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  badgeNew: {
    backgroundColor: "#0284C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeNewText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  actionsContainer: {
    flexDirection: "column",
    gap: 10,
  },
  button: {
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  confirmButton: {
    backgroundColor: "#F59E0B",
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  confirmButtonHint: {
    color: "#FEF3C7",
    fontSize: 11,
    marginTop: 2,
  },
  cancelButton: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  cancelButtonText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
  },
});
