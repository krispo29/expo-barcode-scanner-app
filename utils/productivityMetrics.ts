import AsyncStorage from "@react-native-async-storage/async-storage";

export type ShiftMetrics = {
  date: string; // YYYY-MM-DD
  totalScans: number;
  byCategory: Record<string, number>; // Lot No or Customer Code
  recentTimestamps: number[]; // Epoch ms of recent scans
};

export const METRICS_STORAGE_KEYS = {
  RECEIVE_METRICS: "@shift_metrics_receive",
  RELEASE_METRICS: "@shift_metrics_release",
  SOUND_ENABLED: "@warehouse_sound_enabled",
  SOUND_BOOST: "@warehouse_sound_boost",
};

export function getTodayDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getInitialShiftMetrics(date: string = getTodayDateString()): ShiftMetrics {
  return {
    date,
    totalScans: 0,
    byCategory: {},
    recentTimestamps: [],
  };
}

// In-Memory cache for shift metrics per key (0ms reads, non-blocking writes for rapid scanning)
const metricsMemoryCache = new Map<string, ShiftMetrics>();

export function clearMetricsMemoryCacheForTesting(): void {
  metricsMemoryCache.clear();
}

export async function loadShiftMetrics(key: string): Promise<ShiftMetrics> {
  const today = getTodayDateString();

  // Fast path: In-memory cache hit
  if (metricsMemoryCache.has(key)) {
    const cached = metricsMemoryCache.get(key)!;
    if (cached.date === today) {
      return cached;
    }
  }

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      const initial = getInitialShiftMetrics(today);
      metricsMemoryCache.set(key, initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as ShiftMetrics;
    if (parsed.date !== today) {
      // Auto-reset when new day starts
      const fresh = getInitialShiftMetrics(today);
      metricsMemoryCache.set(key, fresh);
      void saveShiftMetrics(key, fresh);
      return fresh;
    }
    const result: ShiftMetrics = {
      date: parsed.date,
      totalScans: Number(parsed.totalScans) || 0,
      byCategory: parsed.byCategory || {},
      recentTimestamps: Array.isArray(parsed.recentTimestamps) ? parsed.recentTimestamps : [],
    };
    metricsMemoryCache.set(key, result);
    return result;
  } catch (err) {
    console.error(`Error loading shift metrics (${key}):`, err);
    const fallback = getInitialShiftMetrics(today);
    metricsMemoryCache.set(key, fallback);
    return fallback;
  }
}

export async function saveShiftMetrics(key: string, metrics: ShiftMetrics): Promise<void> {
  metricsMemoryCache.set(key, metrics);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(metrics));
  } catch (err) {
    console.error(`Error saving shift metrics (${key}):`, err);
  }
}

export async function recordScanMetric(
  key: string,
  categoryKey: string,
  timestamp: number = Date.now(),
): Promise<ShiftMetrics> {
  const current = await loadShiftMetrics(key);
  const fiveMinutesAgo = timestamp - 300_000;

  // Prune timestamps older than 5 minutes to keep storage lightweight
  const prunedTimestamps = current.recentTimestamps.filter((t) => t >= fiveMinutesAgo);
  prunedTimestamps.push(timestamp);

  const safeCategory = categoryKey.trim() || "OTHER";
  const updatedCategoryCount = (current.byCategory[safeCategory] || 0) + 1;

  const updated: ShiftMetrics = {
    date: current.date,
    totalScans: current.totalScans + 1,
    byCategory: {
      ...current.byCategory,
      [safeCategory]: updatedCategoryCount,
    },
    recentTimestamps: prunedTimestamps,
  };

  // Eagerly update in-memory cache so UI gets the fresh metrics immediately
  metricsMemoryCache.set(key, updated);

  // Persist to storage in background (non-blocking) so scanning feedback is instant
  void saveShiftMetrics(key, updated);

  return updated;
}

export async function resetShiftMetrics(key: string): Promise<ShiftMetrics> {
  const fresh = getInitialShiftMetrics(getTodayDateString());
  metricsMemoryCache.set(key, fresh);
  await saveShiftMetrics(key, fresh);
  return fresh;
}

/**
 * Calculates current scanning velocity in Scans Per Minute (SPM).
 * Uses a rolling window of recent timestamps.
 */
export function calculateScanVelocity(
  timestamps: number[],
  windowSeconds: number = 60,
  now: number = Date.now(),
): number {
  if (!timestamps || timestamps.length === 0) return 0;

  const cutoff = now - windowSeconds * 1000;
  const inWindow = timestamps.filter((t) => t >= cutoff && t <= now);
  const count = inWindow.length;

  if (count === 0) return 0;
  if (count === 1) return 1;

  const earliest = Math.min(...inWindow);
  const elapsedSec = Math.max(4, (now - earliest) / 1000);
  const spm = Math.round((count / elapsedSec) * 60);

  // Cap at 150 SPM (realistic physical maximum for manual barcode scanning)
  return Math.min(spm, 150);
}

export async function getSoundSettings(): Promise<{ enabled: boolean; boost: boolean }> {
  try {
    const [enabledRaw, boostRaw] = await Promise.all([
      AsyncStorage.getItem(METRICS_STORAGE_KEYS.SOUND_ENABLED),
      AsyncStorage.getItem(METRICS_STORAGE_KEYS.SOUND_BOOST),
    ]);
    return {
      enabled: enabledRaw !== null ? enabledRaw === "true" : true, // default true
      boost: boostRaw === "true", // default false (boost on demand)
    };
  } catch (err) {
    console.error("Error reading sound settings:", err);
    return { enabled: true, boost: false };
  }
}

export async function saveSoundSettings(settings: {
  enabled: boolean;
  boost: boolean;
}): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.setItem(METRICS_STORAGE_KEYS.SOUND_ENABLED, String(settings.enabled)),
      AsyncStorage.setItem(METRICS_STORAGE_KEYS.SOUND_BOOST, String(settings.boost)),
    ]);
  } catch (err) {
    console.error("Error saving sound settings:", err);
  }
}
