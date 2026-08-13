import { describe, expect, test } from "@jest/globals";
import { classifyScanError, getScanErrorMessage } from "./ScanErrorModal";

describe("scan error classification", () => {
  test.each(["ALREADY_RECEIVED", "ALREADY_RELEASED"])(
    "maps %s to duplicate",
    (code) => expect(classifyScanError(undefined, code)).toBe("duplicate"),
  );

  test("maps not-found responses to invalid copy", () => {
    expect(getScanErrorMessage(classifyScanError("not found"))).toBe(
      "เลขนี้ไม่ถูกต้อง",
    );
  });

  test("keeps system failures distinct from invalid barcodes", () => {
    expect(
      getScanErrorMessage(classifyScanError(undefined, undefined, true)),
    ).toBe("ไม่สามารถตรวจสอบรายการได้");
  });
});
