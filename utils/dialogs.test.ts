import { describe, expect, jest, test } from "@jest/globals";
import { Platform } from "react-native";
import { showConfirmDialog } from "./dialogs";

describe("showConfirmDialog", () => {
  test("calls onConfirm when user accepts on web", () => {
    const originalOS = Platform.OS;
    (Platform as any).OS = "web";

    const originalConfirm = (global as any).window?.confirm;
    if (!(global as any).window) (global as any).window = {};
    (global as any).window.confirm = jest.fn(() => true);

    const onConfirm: () => void = jest.fn();
    const onCancel: () => void = jest.fn();

    showConfirmDialog({
      title: "Confirm",
      message: "Are you sure?",
      onConfirm,
      onCancel,
    });

    expect((global as any).window.confirm).toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();

    (global as any).window.confirm = originalConfirm;
    (Platform as any).OS = originalOS;
  });

  test("calls onCancel when user declines on web", () => {
    const originalOS = Platform.OS;
    (Platform as any).OS = "web";

    const originalConfirm = (global as any).window?.confirm;
    if (!(global as any).window) (global as any).window = {};
    (global as any).window.confirm = jest.fn(() => false);

    const onConfirm: () => void = jest.fn();
    const onCancel: () => void = jest.fn();

    showConfirmDialog({
      title: "Confirm",
      message: "Are you sure?",
      onConfirm,
      onCancel,
    });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();

    (global as any).window.confirm = originalConfirm;
    (Platform as any).OS = originalOS;
  });
});
