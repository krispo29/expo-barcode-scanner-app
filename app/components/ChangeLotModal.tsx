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

export type ChangeLotModalProps = {
  visible: boolean;
  trackingNo: string;
  originalLot: string;
  newLotLabel: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ChangeLotModal({
  visible,
  trackingNo,
  originalLot,
  newLotLabel,
  loading = false,
  onCancel,
  onConfirm,
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
            ยืนยันการเปลี่ยน Lot / Confirm Change Lot
          </Text>
          <Text style={styles.subtitle}>
            คุณต้องการยืนยันการเปลี่ยน Lot สำหรับ Tracking นี้และทำการ Receive หรือไม่?
          </Text>

          <View style={styles.detailBox}>
            <View style={styles.row}>
              <Text style={styles.label}>Tracking No.: </Text>
              <Text style={styles.trackingText}>{trackingNo}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Lot เดิมของ Tracking: </Text>
              <View style={styles.badgeOriginal}>
                <Text style={styles.badgeOriginalText}>
                  {originalLot || "ไม่ระบุ"}
                </Text>
              </View>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Lot ใหม่ที่เลือก: </Text>
              <View style={styles.badgeNew}>
                <Text style={styles.badgeNewText}>{newLotLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>ยกเลิก / Cancel</Text>
            </TouchableOpacity>

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
                <Text style={styles.confirmButtonText}>ยืนยันเปลี่ยน Lot</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  card: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 20,
    lineHeight: 20,
  },
  detailBox: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 16,
    backgroundColor: "#F8FAFC",
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginVertical: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  trackingText: {
    fontSize: 15,
    fontWeight: "700",
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
    fontWeight: "600",
  },
  badgeNew: {
    backgroundColor: "#06B6D4",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeNewText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  button: {
    minWidth: 130,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#F43F5E",
  },
  cancelButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  confirmButton: {
    backgroundColor: "#F59E0B",
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
