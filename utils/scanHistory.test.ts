import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// Mock AsyncStorage using the official mock provided by @react-native-async-storage/async-storage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  appendScanRecord,
  clearScanHistory,
  getReceiveHistoryKey,
  getReleaseHistoryKey,
  loadScanHistory,
  saveScanHistory,
} from "./scanHistory";

describe("scanHistory utility", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test("generates expected storage keys", () => {
    expect(getReceiveHistoryKey("lot-123")).toBe("@scan_history_receive_lot-123");
    expect(getReleaseHistoryKey("cust-456")).toBe("@scan_history_release_cust-456");
  });

  test("loads empty array when no history exists", async () => {
    const history = await loadScanHistory("dummy-key");
    expect(history).toEqual([]);
  });

  test("saves and loads history records", async () => {
    const key = getReceiveHistoryKey("lot-1");
    const records = [{ id: "1", code: "TRACK01" }, { id: "2", code: "TRACK02" }];

    await saveScanHistory(key, records);
    const loaded = await loadScanHistory<typeof records[0]>(key);
    expect(loaded).toHaveLength(2);
    expect(loaded[0].code).toBe("TRACK01");
  });

  test("appends records prepending to top and deduping code", async () => {
    const key = getReceiveHistoryKey("lot-1");
    await appendScanRecord(key, { code: "TRACK01", val: 1 });
    await appendScanRecord(key, { code: "TRACK02", val: 2 });
    const updated = await appendScanRecord(key, { code: "TRACK01", val: 3 });

    expect(updated).toHaveLength(2);
    expect(updated[0]).toEqual({ code: "TRACK01", val: 3 });
    expect(updated[1]).toEqual({ code: "TRACK02", val: 2 });
  });

  test("clears scan history", async () => {
    const key = getReleaseHistoryKey("cust-1");
    await appendScanRecord(key, { code: "TRACK01" });
    await clearScanHistory(key);

    const loaded = await loadScanHistory(key);
    expect(loaded).toEqual([]);
  });
});
