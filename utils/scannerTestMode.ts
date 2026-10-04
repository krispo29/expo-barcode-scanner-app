export const isScannerTestMode =
  process.env.EXPO_PUBLIC_SCANNER_TEST_MODE === "true";

export type ScannerTestOutcome =
  | "success"
  | "invalid"
  | "system"
  | "lot_mismatch";

export type LotNo = {
  code: string;
  refLotNo: string;
  company: string;
  countryCode: string;
  shippingTypeCode: string;
  mawbUUID: string;
  createdAt: string;
};

export const TEST_LOTS: LotNo[] = [
  {
    code: "HPC26011",
    refLotNo: "TEST-LOT-RECEIVE-002",
    company: "HPC",
    countryCode: "TH",
    shippingTypeCode: "air",
    mawbUUID: "9010171b-8f2d-4f9e-a520-a476ef490496",
    createdAt: "02-10-2026 10:02:16",
  },
  {
    code: "HPC26010",
    refLotNo: "TEST-LOT-RECEIVE-001",
    company: "HPC",
    countryCode: "TH",
    shippingTypeCode: "air",
    mawbUUID: "090fb07b-1ada-4ea2-8650-82b53f6d4936",
    createdAt: "02-10-2026 10:02:12",
  },
];

export const getScannerTestOutcome = (code: string): ScannerTestOutcome => {
  if (code.startsWith("INVALID")) return "invalid";
  if (code.startsWith("SYSTEM")) return "system";
  if (code === "TESTD02" || code.startsWith("LOTMISMATCH")) return "lot_mismatch";
  return "success";
};
