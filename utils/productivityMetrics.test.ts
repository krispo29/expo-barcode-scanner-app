import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// Mock AsyncStorage using the official mock provided by @react-native-async-storage/async-storage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  calculateScanVelocity,
  getInitialShiftMetrics,
  getSoundSettings,
  getTodayDateString,
  loadShiftMetrics,
  METRICS_STORAGE_KEYS,
  recordScanMetric,
  resetShiftMetrics,
  saveSoundSettings,
} from "./productivityMetrics";

describe("productivityMetrics utility", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test("loads initial shift metrics if none saved", async () => {
    const metrics = await loadShiftMetrics(METRICS_STORAGE_KEYS.RECEIVE_METRICS);
    expect(metrics.totalScans).toBe(0);
    expect(metrics.byCategory).toEqual({});
    expect(metrics.date).toBe(getTodayDateString());
  });

  test("records scans and updates category count and timestamps", async () => {
    const now = Date.now();
    const updated = await recordScanMetric(
      METRICS_STORAGE_KEYS.RECEIVE_METRICS,
      "LOT-A",
      now,
    );
    expect(updated.totalScans).toBe(1);
    expect(updated.byCategory["LOT-A"]).toBe(1);
    expect(updated.recentTimestamps).toHaveLength(1);

    const second = await recordScanMetric(
      METRICS_STORAGE_KEYS.RECEIVE_METRICS,
      "LOT-A",
      now + 1000,
    );
    expect(second.totalScans).toBe(2);
    expect(second.byCategory["LOT-A"]).toBe(2);

    const third = await recordScanMetric(
      METRICS_STORAGE_KEYS.RECEIVE_METRICS,
      "LOT-B",
      now + 2000,
    );
    expect(third.totalScans).toBe(3);
    expect(third.byCategory["LOT-A"]).toBe(2);
    expect(third.byCategory["LOT-B"]).toBe(1);
  });

  test("auto-resets when saved date is not today", async () => {
    const yesterdayMetrics = {
      date: "2020-01-01",
      totalScans: 150,
      byCategory: { "LOT-OLD": 150 },
      recentTimestamps: [],
    };
    await AsyncStorage.setItem(
      METRICS_STORAGE_KEYS.RECEIVE_METRICS,
      JSON.stringify(yesterdayMetrics),
    );

    const loaded = await loadShiftMetrics(METRICS_STORAGE_KEYS.RECEIVE_METRICS);
    expect(loaded.date).toBe(getTodayDateString());
    expect(loaded.totalScans).toBe(0);
    expect(loaded.byCategory).toEqual({});
  });

  test("manually resets shift metrics", async () => {
    await recordScanMetric(METRICS_STORAGE_KEYS.RELEASE_METRICS, "CUST-1");
    await recordScanMetric(METRICS_STORAGE_KEYS.RELEASE_METRICS, "CUST-2");

    const reset = await resetShiftMetrics(METRICS_STORAGE_KEYS.RELEASE_METRICS);
    expect(reset.totalScans).toBe(0);
    expect(reset.byCategory).toEqual({});
    expect(reset.recentTimestamps).toEqual([]);
  });

  test("calculates scan velocity (SPM) correctly", () => {
    const now = 100000;
    // 0 scans -> 0 SPM
    expect(calculateScanVelocity([], 60, now)).toBe(0);

    // 1 scan -> 1 SPM
    expect(calculateScanVelocity([now], 60, now)).toBe(1);

    // 4 scans within 12 seconds: 4 / 12 * 60 = 20 SPM
    const timestamps = [now - 12000, now - 8000, now - 4000, now];
    const velocity = calculateScanVelocity(timestamps, 60, now);
    expect(velocity).toBe(20);

    // Old scans outside 60s window are ignored
    const oldTimestamps = [now - 90000, now - 70000, now - 5000];
    expect(calculateScanVelocity(oldTimestamps, 60, now)).toBe(1);
  });

  test("handles sound settings get and save", async () => {
    const initial = await getSoundSettings();
    expect(initial.enabled).toBe(true);
    expect(initial.boost).toBe(false);

    await saveSoundSettings({ enabled: false, boost: true });
    const updated = await getSoundSettings();
    expect(updated.enabled).toBe(false);
    expect(updated.boost).toBe(true);
  });
});
