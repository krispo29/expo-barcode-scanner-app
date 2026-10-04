/**
 * Helper utilities for maintaining recent selections (Lots, Customers)
 * for rapid thumb switching in warehouse environments.
 */

export function updateRecentIds(
  recentIds: string[],
  newId: string,
  maxCount: number = 4,
): string[] {
  if (!newId || typeof newId !== "string") return recentIds;
  const filtered = recentIds.filter((id) => id !== newId);
  return [newId, ...filtered].slice(0, maxCount);
}
