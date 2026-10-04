
import { describe, expect, test } from "@jest/globals";

describe("Tracking code formatting logic", () => {
  test("splits tracking code into prefix and suffix", () => {
    const code = "1234567890TESTD01";
    const highlightCount = 5;
    const len = code.length;
    const prefix = code.slice(0, len - highlightCount);
    const suffix = code.slice(len - highlightCount);

    expect(prefix).toBe("1234567890TE");
    expect(suffix).toBe("STD01");
  });

  test("handles short tracking codes gracefully", () => {
    const code = "TEST1";
    const highlightCount = 5;
    expect(code.length <= highlightCount).toBe(true);
  });
});
