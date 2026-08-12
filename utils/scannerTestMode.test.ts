import { describe, expect, test } from "@jest/globals";
import { getScannerTestOutcome } from "./scannerTestMode";

describe("scanner test outcomes", () => {
  test("maps test codes to local results", () => {
    expect(getScannerTestOutcome("TEST001")).toBe("success");
    expect(getScannerTestOutcome("INVALID001")).toBe("invalid");
    expect(getScannerTestOutcome("SYSTEM001")).toBe("system");
  });
});
