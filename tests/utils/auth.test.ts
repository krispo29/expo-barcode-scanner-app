import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearStoredAuth,
  getValidAccessToken,
  getValidAccessTokenSync,
  isExpired,
  persistAuthSession,
  readStoredSession,
  resetMemoryAuthCacheForTesting,
} from "../../utils/auth";

describe("auth utility with In-Memory Caching", () => {
  beforeEach(async () => {
    resetMemoryAuthCacheForTesting();
    await AsyncStorage.clear();
  });

  test("returns null when no session is stored", async () => {
    const token = await getValidAccessToken();
    expect(token).toBeNull();
    expect(getValidAccessTokenSync()).toBeNull();
  });

  test("persists session and caches immediately in memory for 0ms reads", async () => {
    const payload = {
      access_token: "test-token-123",
      expires_in: 3600, // 1 hour
    };

    await persistAuthSession(payload);

    // Synchronous memory read should immediately succeed without awaiting disk
    expect(getValidAccessTokenSync()).toBe("test-token-123");

    // Async read should also return cached token
    const token = await getValidAccessToken();
    expect(token).toBe("test-token-123");
  });

  test("clears in-memory cache and storage on clearStoredAuth", async () => {
    await persistAuthSession({
      access_token: "active-token",
      expires_in: 3600,
    });

    expect(getValidAccessTokenSync()).toBe("active-token");

    await clearStoredAuth();

    expect(getValidAccessTokenSync()).toBeNull();
    const token = await getValidAccessToken();
    expect(token).toBeNull();
  });

  test("populates memory cache on cold start readStoredSession", async () => {
    // Simulate preexisting token in storage
    const expiresAt = Date.now() + 3600 * 1000;
    await AsyncStorage.multiSet([
      ["access_token", "cold-start-token"],
      ["user_data", JSON.stringify({ email: "test@example.com" })],
      ["token_expires_at", expiresAt.toString()],
    ]);

    expect(getValidAccessTokenSync()).toBeNull(); // Cache is empty before read

    const token = await getValidAccessToken();
    expect(token).toBe("cold-start-token");

    // After cold start, memory cache is populated
    expect(getValidAccessTokenSync()).toBe("cold-start-token");
  });

  test("rejects and purges expired token", async () => {
    // Expired token (10 seconds ago)
    const expiresAt = Date.now() - 10000;
    await AsyncStorage.multiSet([
      ["access_token", "expired-token"],
      ["token_expires_at", expiresAt.toString()],
    ]);

    const token = await getValidAccessToken();
    expect(token).toBeNull();
    expect(getValidAccessTokenSync()).toBeNull();
  });

  test("isExpired correctly computes expiration skew", () => {
    const now = Date.now();
    expect(isExpired(null)).toBe(true);
    expect(isExpired(undefined)).toBe(true);
    expect(isExpired(now - 1000, now)).toBe(true);
    expect(isExpired(now + 10_000, now)).toBe(true); // Within 30s skew window
    expect(isExpired(now + 60_000, now)).toBe(false); // Valid beyond 30s
  });
});
