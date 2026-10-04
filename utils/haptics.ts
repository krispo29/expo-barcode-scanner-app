import { Platform, Vibration } from "react-native";

/**
 * Industrial Haptic Feedback for Warehouse Scanners (CipherLab RS51, etc.)
 * Configured with higher intensity and distinct patterns to pierce through rugged rubber cases and work gloves.
 */

export const triggerSuccessHaptic = () => {
  try {
    if (Platform.OS === "android") {
      Vibration.vibrate(80);
    } else {
      Vibration.vibrate(50);
    }
  } catch {
    // Graceful fallback on devices without vibration support
  }
};

export const triggerWarningHaptic = () => {
  try {
    if (Platform.OS === "android") {
      // 2 quick distinct pulses: wait 0ms, vibrate 100ms, pause 80ms, vibrate 150ms
      Vibration.vibrate([0, 100, 80, 150]);
    } else {
      Vibration.vibrate(100);
    }
  } catch {
    // Graceful fallback
  }
};

export const triggerErrorHaptic = () => {
  try {
    if (Platform.OS === "android") {
      // Urgent triple pulse: wait 0ms, vibrate 150ms, pause 80ms, vibrate 150ms, pause 80ms, vibrate 200ms
      Vibration.vibrate([0, 150, 80, 150, 80, 200]);
    } else {
      Vibration.vibrate(200);
    }
  } catch {
    // Graceful fallback
  }
};
