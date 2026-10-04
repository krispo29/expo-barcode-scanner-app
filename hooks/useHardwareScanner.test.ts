import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { renderHook, act } from "@testing-library/react-native";
import { useHardwareScanner, SCANNER_AUTO_SUBMIT_DELAY_MS } from "./useHardwareScanner";

describe("useHardwareScanner hook", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("initializes with default values", () => {
    const onScan = jest.fn<(rawValue: string, mode: "auto" | "manual") => void>();
    const { result } = renderHook(() =>
      useHardwareScanner({ canScan: true, onScan }),
    );

    expect(result.current.input).toBe("");
    expect(result.current.autoEnter).toBe(true);
    expect(result.current.showSoftKeyboard).toBe(false);
    expect(result.current.scannedLock).toBe(false);
  });

  test("triggers onScan immediately when newline/Enter character is typed", () => {
    const onScan = jest.fn<(rawValue: string, mode: "auto" | "manual") => void>();
    const { result } = renderHook(() =>
      useHardwareScanner({ canScan: true, onScan }),
    );

    act(() => {
      result.current.handleInputChange("TEST1234\n");
    });

    expect(onScan).toHaveBeenCalledWith("TEST1234", "auto");
    expect(result.current.input).toBe("TEST1234");
  });

  test("triggers onScan after delay when autoEnter is true without newline", () => {
    const onScan = jest.fn<(rawValue: string, mode: "auto" | "manual") => void>();
    const { result } = renderHook(() =>
      useHardwareScanner({ canScan: true, onScan }),
    );

    act(() => {
      result.current.handleInputChange("TEST5678");
    });

    expect(onScan).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(SCANNER_AUTO_SUBMIT_DELAY_MS);
    });

    expect(onScan).toHaveBeenCalledWith("TEST5678", "auto");
  });

  test("blocks input handling when canScan is false", () => {
    const onScan = jest.fn<(rawValue: string, mode: "auto" | "manual") => void>();
    const { result } = renderHook(() =>
      useHardwareScanner({ canScan: false, onScan }),
    );

    act(() => {
      result.current.handleInputChange("TEST9999\n");
    });

    expect(onScan).not.toHaveBeenCalled();
  });

  test("resets input correctly", () => {
    const onScan = jest.fn<(rawValue: string, mode: "auto" | "manual") => void>();
    const { result } = renderHook(() =>
      useHardwareScanner({ canScan: true, onScan }),
    );

    act(() => {
      result.current.handleInputChange("TEST9999");
    });
    expect(result.current.input).toBe("TEST9999");

    act(() => {
      result.current.resetInput();
    });
    expect(result.current.input).toBe("");
    expect(result.current.latestInputRef.current).toBe("");
  });
});
