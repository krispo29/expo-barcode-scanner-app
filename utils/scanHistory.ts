import AsyncStorage from "@react-native-async-storage/async-storage";

// In-Memory cache for scan history per key (0ms reads, eliminates blocking disk I/O on rapid scans)
const historyMemoryCache = new Map<string, any[]>();

export function clearAllScanHistoryCacheForTesting(): void {
  historyMemoryCache.clear();
}

export function getReceiveHistoryKey(mawbUUID: string): string {
  return `@scan_history_receive_${mawbUUID}`;
}

export function getReleaseHistoryKey(customerUuid: string): string {
  return `@scan_history_release_${customerUuid}`;
}

export async function loadScanHistory<T>(key: string): Promise<T[]> {
  if (!key) return [];

  // Fast path: In-memory cache hit (0ms)
  if (historyMemoryCache.has(key)) {
    return (historyMemoryCache.get(key) as T[]) || [];
  }

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      historyMemoryCache.set(key, []);
      return [];
    }
    const parsed = JSON.parse(raw);
    const result = Array.isArray(parsed) ? parsed : [];
    historyMemoryCache.set(key, result);
    return result;
  } catch (err) {
    console.error(`Error loading scan history (${key}):`, err);
    return [];
  }
}

export async function saveScanHistory<T>(key: string, history: T[]): Promise<void> {
  if (!key) return;
  historyMemoryCache.set(key, history);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(history));
  } catch (err) {
    console.error(`Error saving scan history (${key}):`, err);
  }
}

export async function appendScanRecord<T extends { code: string }>(
  key: string,
  record: T,
  maxItems: number = 30,
): Promise<T[]> {
  let current: T[];
  if (historyMemoryCache.has(key)) {
    current = historyMemoryCache.get(key) as T[];
  } else {
    current = await loadScanHistory<T>(key);
  }

  // Filter out matching code so latest scan is at the top without duplicate entries
  const filtered = current.filter((item) => item.code !== record.code);
  const updated = [record, ...filtered].slice(0, maxItems);

  // Eagerly update memory cache so UI gets the fresh list immediately
  historyMemoryCache.set(key, updated);

  // Persist to storage in background (non-blocking) so scanner feedback is instant
  void saveScanHistory(key, updated);

  return updated;
}

export async function clearScanHistory(key: string): Promise<void> {
  if (!key) return;
  historyMemoryCache.delete(key);
  try {
    await AsyncStorage.removeItem(key);
  } catch (err) {
    console.error(`Error clearing scan history (${key}):`, err);
  }
}
