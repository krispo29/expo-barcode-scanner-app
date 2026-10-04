import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// Mock AsyncStorage using the official mock provided by @react-native-async-storage/async-storage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addToOfflineQueue,
  clearOfflineQueue,
  getOfflineQueue,
  isTrackingInQueue,
  OFFLINE_STORAGE_KEYS,
  ReceiveQueueItem,
  removeFromOfflineQueue,
} from "./offlineQueue";

describe("offlineQueue utility", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test("loads empty array when queue is empty", async () => {
    const queue = await getOfflineQueue(OFFLINE_STORAGE_KEYS.RECEIVE_QUEUE);
    expect(queue).toEqual([]);
  });

  test("adds items and persists them", async () => {
    const item1: ReceiveQueueItem = {
      id: "1",
      trackingNo: "TEST001",
      mawbUUID: "mawb-1",
      lotRef: "LOT-001",
      timestamp: new Date().toISOString(),
      mode: "auto",
    };

    const updated = await addToOfflineQueue(
      OFFLINE_STORAGE_KEYS.RECEIVE_QUEUE,
      item1,
    );
    expect(updated).toHaveLength(1);
    expect(updated[0].trackingNo).toBe("TEST001");

    const reloaded = await getOfflineQueue(OFFLINE_STORAGE_KEYS.RECEIVE_QUEUE);
    expect(reloaded).toHaveLength(1);
  });

  test("avoids duplicate tracking numbers in queue", async () => {
    const item: ReceiveQueueItem = {
      id: "1",
      trackingNo: "TEST001",
      mawbUUID: "mawb-1",
      lotRef: "LOT-001",
      timestamp: new Date().toISOString(),
      mode: "auto",
    };

    await addToOfflineQueue(OFFLINE_STORAGE_KEYS.RECEIVE_QUEUE, item);
    const result = await addToOfflineQueue(
      OFFLINE_STORAGE_KEYS.RECEIVE_QUEUE,
      item,
    );
    expect(result).toHaveLength(1);
  });

  test("removes item by tracking number or id", async () => {
    const item1: ReceiveQueueItem = {
      id: "item-1",
      trackingNo: "TEST001",
      mawbUUID: "mawb-1",
      lotRef: "LOT-001",
      timestamp: new Date().toISOString(),
      mode: "auto",
    };
    const item2: ReceiveQueueItem = {
      id: "item-2",
      trackingNo: "TEST002",
      mawbUUID: "mawb-1",
      lotRef: "LOT-001",
      timestamp: new Date().toISOString(),
      mode: "auto",
    };

    await addToOfflineQueue(OFFLINE_STORAGE_KEYS.RECEIVE_QUEUE, item1);
    await addToOfflineQueue(OFFLINE_STORAGE_KEYS.RECEIVE_QUEUE, item2);

    const remaining = await removeFromOfflineQueue(
      OFFLINE_STORAGE_KEYS.RECEIVE_QUEUE,
      "TEST001",
    );
    expect(remaining).toHaveLength(1);
    expect(remaining[0].trackingNo).toBe("TEST002");
  });

  test("checks if tracking exists in queue case-insensitively", () => {
    const queue: ReceiveQueueItem[] = [
      {
        id: "1",
        trackingNo: "TEST001",
        mawbUUID: "mawb-1",
        lotRef: "LOT-001",
        timestamp: new Date().toISOString(),
        mode: "auto",
      },
    ];

    expect(isTrackingInQueue(queue, "test001")).toBe(true);
    expect(isTrackingInQueue(queue, "TEST001")).toBe(true);
    expect(isTrackingInQueue(queue, "TEST002")).toBe(false);
  });
});
