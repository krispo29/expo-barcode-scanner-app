import { describe, expect, test } from "@jest/globals";
import {
  extractOriginalLot,
  findLotByCodeOrRef,
  isLotMismatchError,
  isSameLot,
} from "../../app/components/ChangeLotModal";

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

  test("finds lot by refLotNo or code", () => {
    const mockLots = [
      { code: "HPC26011", refLotNo: "TEST-LOT-RECEIVE-002" },
      { code: "HPC26010", refLotNo: "TEST-LOT-RECEIVE-001" },
    ];

    expect(findLotByCodeOrRef(mockLots, "TEST-LOT-RECEIVE-001")?.code).toBe(
      "HPC26010",
    );
    expect(findLotByCodeOrRef(mockLots, "hpc26011")?.refLotNo).toBe(
      "TEST-LOT-RECEIVE-002",
    );
    expect(findLotByCodeOrRef(mockLots, "NON_EXISTENT")).toBeUndefined();
    expect(findLotByCodeOrRef(mockLots, undefined)).toBeUndefined();
  });

  test("correctly identifies when original lot is actually the same lot", () => {
    const selectedLot = {
      code: "HPC26010",
      refLotNo: "TEST-LOT-RECEIVE-001",
      mawbUUID: "mawb-1234",
    };
    const mockLots = [
      selectedLot,
      {
        code: "HPC26011",
        refLotNo: "TEST-LOT-RECEIVE-002",
        mawbUUID: "mawb-5678",
      },
    ];

    // Same by code
    expect(isSameLot(selectedLot, "HPC26010", mockLots)).toBe(true);
    expect(isSameLot(selectedLot, "hpc26010", mockLots)).toBe(true);

    // Same by refLotNo
    expect(isSameLot(selectedLot, "TEST-LOT-RECEIVE-001", mockLots)).toBe(true);
    expect(isSameLot(selectedLot, "test-lot-receive-001", mockLots)).toBe(true);

    // Same by mawbUUID
    expect(isSameLot(selectedLot, "mawb-1234", mockLots)).toBe(true);

    // Truly different lot
    expect(isSameLot(selectedLot, "HPC26011", mockLots)).toBe(false);
    expect(isSameLot(selectedLot, "TEST-LOT-RECEIVE-002", mockLots)).toBe(false);
    expect(isSameLot(selectedLot, "OTHER-LOT", mockLots)).toBe(false);
    expect(isSameLot(selectedLot, undefined, mockLots)).toBe(false);
    expect(isSameLot(null, "HPC26010", mockLots)).toBe(false);
  });
});
