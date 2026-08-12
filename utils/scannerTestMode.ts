export const isScannerTestMode =
  process.env.EXPO_PUBLIC_SCANNER_TEST_MODE === "true";

export type ScannerTestOutcome = "success" | "invalid" | "system";

export const getScannerTestOutcome = (code: string): ScannerTestOutcome => {
  if (code.startsWith("INVALID")) return "invalid";
  if (code.startsWith("SYSTEM")) return "system";
  return "success";
};
