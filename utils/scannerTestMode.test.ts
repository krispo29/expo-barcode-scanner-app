import { describe, expect, test } from "@jest/globals";
import { getScannerTestOutcome } from "./scannerTestMode";

describe("scanner test outcomes", () => {
  test("maps test codes to local results", () => {
    expect(getScannerTestOutcome("TEST001")).toBe("success");
    expect(getScannerTestOutcome("INVALID001")).toBe("invalid");
    expect(getScannerTestOutcome("SYSTEM001")).toBe("system");
    expect(getScannerTestOutcome("TESTD02")).toBe("lot_mismatch");
    expect(getScannerTestOutcome("LOTMISMATCH123")).toBe("lot_mismatch");
    expect(getScannerTestOutcome("TEST-MISMATCH-01")).toBe("lot_mismatch");
    expect(getScannerTestOutcome("NOTFOUND01")).toBe("invalid");
    expect(getScannerTestOutcome("OFFLINE01")).toBe("system");
  });

  test("identifies test outcomes that should bypass duplicate checks", () => {
    const isSpecialCase = (code: string) => {
      const outcome = getScannerTestOutcome(code);
      return outcome === "lot_mismatch" || outcome === "invalid" || outcome === "system";
    };

    expect(isSpecialCase("TESTD02")).toBe(true);
    expect(isSpecialCase("LOTMISMATCH01")).toBe(true);
    expect(isSpecialCase("INVALID01")).toBe(true);
    expect(isSpecialCase("SYSTEM01")).toBe(true);
    expect(isSpecialCase("TEST-AIR-01")).toBe(false);
    expect(isSpecialCase("TEST001")).toBe(false);
  });
});
