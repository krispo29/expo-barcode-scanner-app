import AsyncStorage from "@react-native-async-storage/async-storage";

export function getReceiveHistoryKey(mawbUUID: string): string {
  return `@scan_history_receive_${mawbUUID}`;
}

export function getReleaseHistoryKey(customerUuid: string): string {
  return `@scan_history_release_${customerUuid}`;
}

export async function loadScanHistory<T>(key: string): Promise<T[]> {
  if (!key) return [];
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`Error loading scan history (${key}):`, err);
    return [];
  }
}

export async function saveScanHistory<T>(key: string, history: T[]): Promise<void> {
  if (!key) return;
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
  const current = await loadScanHistory<T>(key);
  // Filter out matching code so the latest scan is at the top without duplicate entries
  const filtered = current.filter((item) => item.code !== record.code);
  const updated = [record, ...filtered].slice(0, maxItems);
  await saveScanHistory(key, updated);
  return updated;
}

export async function clearScanHistory(key: string): Promise<void> {
  if (!key) return;
  try {
    await AsyncStorage.removeItem(key);
  } catch (err) {
    console.error(`Error clearing scan history (${key}):`, err);
  }
}
