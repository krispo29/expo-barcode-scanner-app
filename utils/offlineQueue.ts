import AsyncStorage from "@react-native-async-storage/async-storage";

export type BaseQueueItem = {
  id: string;
  trackingNo: string;
  timestamp: string;
  mode: "auto" | "manual";
};

export type ReceiveQueueItem = BaseQueueItem & {
  mawbUUID: string;
  lotRef: string;
  shippingType?: string;
};

export type ReleaseQueueItem = BaseQueueItem & {
  customerUuid: string;
  customerCode: string;
};

export const OFFLINE_STORAGE_KEYS = {
  RECEIVE_QUEUE: "@offline_queue_receive",
  RELEASE_QUEUE: "@offline_queue_release",
};

export async function getOfflineQueue<T extends BaseQueueItem>(
  key: string,
): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`Error loading offline queue (${key}):`, err);
    return [];
  }
}

export async function saveOfflineQueue<T extends BaseQueueItem>(
  key: string,
  queue: T[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(queue));
  } catch (err) {
    console.error(`Error saving offline queue (${key}):`, err);
  }
}

export async function addToOfflineQueue<T extends BaseQueueItem>(
  key: string,
  item: T,
): Promise<T[]> {
  const current = await getOfflineQueue<T>(key);
  const exists = current.some(
    (q) => q.trackingNo.toUpperCase() === item.trackingNo.toUpperCase(),
  );
  if (exists) return current;
  const updated = [...current, item];
  await saveOfflineQueue(key, updated);
  return updated;
}

export async function removeFromOfflineQueue<T extends BaseQueueItem>(
  key: string,
  idOrTracking: string,
): Promise<T[]> {
  const current = await getOfflineQueue<T>(key);
  const updated = current.filter(
    (q) => q.id !== idOrTracking && q.trackingNo !== idOrTracking,
  );
  await saveOfflineQueue(key, updated);
  return updated;
}

export async function clearOfflineQueue(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (err) {
    console.error(`Error clearing offline queue (${key}):`, err);
  }
}

export function isTrackingInQueue<T extends BaseQueueItem>(
  queue: T[],
  trackingNo: string,
): boolean {
  if (!trackingNo) return false;
  const target = trackingNo.trim().toUpperCase();
  return queue.some((item) => item.trackingNo.trim().toUpperCase() === target);
}
