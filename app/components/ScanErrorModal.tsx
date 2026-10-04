import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type ScanErrorKind =
  | "duplicate"
  | "wrongCustomer"
  | "destinationMismatch"
  | "notFound"
  | "generic"
  | "system";

export const classifyScanError = (
  message?: string,
  apiCode?: number | string,
  systemFailure = false,
): ScanErrorKind => {
  if (systemFailure) return "system";

  const code = apiCode === undefined ? "" : String(apiCode).trim().toUpperCase();
  const normalizedMessage = message?.trim().toLowerCase() ?? "";

  if (
    code === "ALREADY_RECEIVED" ||
    code === "ALREADY_RELEASED" ||
    (normalizedMessage.includes("already") &&
      (normalizedMessage.includes("receive") ||
        normalizedMessage.includes("release")))
  ) {
    return "duplicate";
  }
  if (
    code === "WRONG_CUSTOMER" ||
    normalizedMessage.includes("customer") ||
    message?.includes("ลูกค้า")
  ) {
    return "wrongCustomer";
  }
  if (code === "DESTINATION_COUNTRY_MISMATCH") {
    return "destinationMismatch";
  }
  if (
    code === "NOT_FOUND" ||
    code === "TRACKING_NOT_FOUND" ||
    normalizedMessage.includes("not found") ||
    message?.includes("ไม่พบ")
  ) {
    return "notFound";
  }
  return "generic";
};

export const getScanErrorMessage = (kind: ScanErrorKind) =>
  kind === "duplicate"
    ? "รายการนี้ถูกสแกนแล้ว"
    : kind === "system"
      ? "ไม่สามารถตรวจสอบรายการได้"
      : "เลขนี้ไม่ถูกต้อง";

export type ScanErrorModalProps = {
  kind: ScanErrorKind | null;
  onConfirm: () => void;
  onSaveToOffline?: () => void;
};

export function ScanErrorModal({
  kind,
  onConfirm,
  onSaveToOffline,
}: ScanErrorModalProps) {
  const isSystemError = kind === "system";

  return (
    <Modal
      visible={kind !== null}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.backdrop}>
        <View accessibilityRole="alert" style={styles.card}>
          <Text style={styles.icon}>⚠</Text>
          <Text style={styles.message}>
            {kind ? getScanErrorMessage(kind) : ""}
          </Text>

          {isSystemError && (
            <Text style={styles.hint}>
              อาจเกิดจากจุดอับสัญญาณ Wi-Fi หรือเครือข่ายขัดข้อง
            </Text>
          )}

          <View style={styles.buttonContainer}>
            {isSystemError && onSaveToOffline && (
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.button, styles.offlineButton]}
                onPress={onSaveToOffline}
                activeOpacity={0.8}
              >
                <Text style={styles.offlineButtonText}>
                  📥 บันทึกลงคิวออฟไลน์
                </Text>
                <Text style={styles.offlineButtonSubtext}>
                  เพื่อส่งขึ้นระบบอัตโนมัติเมื่อมีสัญญาณ
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              accessibilityRole="button"
              style={[
                styles.button,
                isSystemError && onSaveToOffline
                  ? styles.secondaryConfirmButton
                  : styles.button,
              ]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.buttonText,
                  isSystemError && onSaveToOffline
                    ? styles.secondaryConfirmButtonText
                    : undefined,
                ]}
              >
                {isSystemError && onSaveToOffline ? "ปิดหน้าต่าง" : "ยืนยัน"}
              </Text>
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
    padding: 24,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    padding: 24,
    borderWidth: 3,
    borderColor: "#DC2626",
    borderRadius: 18,
    backgroundColor: "#FFF7ED",
  },
  icon: {
    marginBottom: 8,
    fontSize: 44,
    color: "#DC2626",
  },
  message: {
    marginBottom: 8,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    color: "#7F1D1D",
  },
  hint: {
    fontSize: 13,
    color: "#991B1B",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  buttonContainer: {
    width: "100%",
    gap: 10,
  },
  button: {
    width: "100%",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#DC2626",
    paddingVertical: 12,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  offlineButton: {
    backgroundColor: "#D97706",
    paddingVertical: 10,
  },
  offlineButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  offlineButtonSubtext: {
    color: "#FEF3C7",
    fontSize: 11,
    marginTop: 2,
  },
  secondaryConfirmButton: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  secondaryConfirmButtonText: {
    color: "#991B1B",
    fontSize: 15,
    fontWeight: "700",
  },
});
