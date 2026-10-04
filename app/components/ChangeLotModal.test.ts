import { describe, expect, test } from "@jest/globals";
import {
  extractOriginalLot,
  isLotMismatchError,
} from "./ChangeLotModal";

describe("ChangeLotModal helpers", () => {
  test("detects lot mismatch error message", () => {
    expect(
      isLotMismatchError("LOT_NO_NOT_MATCH:TEST-LOT-RECEIVE-001"),
    ).toBe(true);
    expect(isLotMismatchError("ALREADY_RECEIVED")).toBe(false);
    expect(isLotMismatchError(undefined)).toBe(false);
  });

  test("extracts original lot from error message", () => {
    expect(
      extractOriginalLot("LOT_NO_NOT_MATCH:TEST-LOT-RECEIVE-001"),
    ).toBe("TEST-LOT-RECEIVE-001");
    expect(
      extractOriginalLot("LOT_NO_NOT_MATCH: HPC26010 "),
    ).toBe("HPC26010");
    expect(extractOriginalLot("SOME_OTHER_ERROR")).toBe("");
    expect(extractOriginalLot(undefined)).toBe("");
  });
});
