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

type ScanErrorModalProps = {
  kind: ScanErrorKind | null;
  onConfirm: () => void;
};

export function ScanErrorModal({ kind, onConfirm }: ScanErrorModalProps) {
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
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.button}
            onPress={onConfirm}
          >
            <Text style={styles.buttonText}>ยืนยัน</Text>
          </TouchableOpacity>
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
    padding: 28,
    borderWidth: 4,
    borderColor: "#DC2626",
    borderRadius: 18,
    backgroundColor: "#FFF7ED",
  },
  icon: {
    marginBottom: 8,
    fontSize: 48,
    color: "#DC2626",
  },
  message: {
    marginBottom: 24,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    color: "#7F1D1D",
  },
  button: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#DC2626",
  },
  buttonText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
