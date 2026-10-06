import { useCallback, useEffect, useRef, useState } from "react";
import { TextInput } from "react-native";

export const SCANNER_AUTO_SUBMIT_DELAY_MS = 150;

export type UseHardwareScannerOptions = {
  canScan: boolean;
  isLocked?: boolean;
  onScan: (rawValue: string, mode: "auto" | "manual") => Promise<void> | void;
};

export function useHardwareScanner({
  canScan,
  isLocked = false,
  onScan,
}: UseHardwareScannerOptions) {
  const [input, setInput] = useState("");
  const [autoEnter, setAutoEnter] = useState(true);
  const [showSoftKeyboard, setShowSoftKeyboard] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [scannedLock, setScannedLock] = useState(false);

  const inputRef = useRef<TextInput | null>(null);
  const latestInputRef = useRef("");
  const autoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanInFlightRef = useRef(false);

  const clearAutoSubmitTimer = useCallback(() => {
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
  }, []);

  const focusTrackingInput = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, []);

  const resetInput = useCallback(() => {
    clearAutoSubmitTimer();
    latestInputRef.current = "";
    setInput("");
  }, [clearAutoSubmitTimer]);

  const toggleSoftKeyboard = useCallback(() => {
    setShowSoftKeyboard((prev) => {
      const next = !prev;
      setTimeout(() => inputRef.current?.focus(), 100);
      return next;
    });
  }, []);

  const handleInputChange = useCallback(
    (text: string) => {
      if (scanInFlightRef.current || isLocked || scannedLock) return;

      const sanitized = text.replaceAll(/[\r\n]/g, "");
      const hasSubmitChar = /[\r\n]/.test(text);
      latestInputRef.current = sanitized;
      setInput(sanitized);
      clearAutoSubmitTimer();

      if (!autoEnter || !sanitized.trim() || !canScan) return;

      if (hasSubmitChar) {
        void onScan(sanitized, "auto");
        return;
      }

      autoSubmitTimerRef.current = setTimeout(() => {
        const latestValue = latestInputRef.current.trim();
        if (latestValue === sanitized.trim()) {
          void onScan(latestValue, "auto");
        }
      }, SCANNER_AUTO_SUBMIT_DELAY_MS);
    },
    [autoEnter, canScan, clearAutoSubmitTimer, isLocked, onScan, scannedLock],
  );

  const handleManualSubmit = useCallback(() => {
    const trackingNumber = latestInputRef.current;
    if (!trackingNumber.trim() || !canScan || isLocked || scannedLock) return;
    clearAutoSubmitTimer();
    void onScan(trackingNumber, autoEnter ? "auto" : "manual");
  }, [autoEnter, canScan, clearAutoSubmitTimer, isLocked, onScan, scannedLock]);

  useEffect(() => {
    return () => {
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    };
  }, []);

  return {
    input,
    setInput,
    inputRef,
    latestInputRef,
    scanInFlightRef,
    autoEnter,
    setAutoEnter,
    showSoftKeyboard,
    setShowSoftKeyboard,
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
  };
}
