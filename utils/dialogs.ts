import { Alert, Platform } from "react-native";

export type ConfirmDialogOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
};

export function showConfirmDialog({
  title,
  message,
  confirmText = "ตกลง",
  cancelText = "ยกเลิก",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogOptions): void {
  if (Platform.OS === "web") {
    const promptText = title ? `${title}\n\n${message}` : message;
    const ok =
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(promptText)
        : true;
    if (ok) {
      void onConfirm();
    } else {
      onCancel?.();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelText, style: "cancel", onPress: onCancel },
    {
      text: confirmText,
      style: destructive ? "destructive" : "default",
      onPress: () => {
        void onConfirm();
      },
    },
  ]);
}
