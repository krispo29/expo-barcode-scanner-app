import AsyncStorage from "@react-native-async-storage/async-storage";

const ACCESS_TOKEN_KEY = "access_token";
const USER_DATA_KEY = "user_data";
const TOKEN_EXPIRES_AT_KEY = "token_expires_at";
const EXPIRY_SKEW_MS = 30_000;
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

type PersistedAuthPayload = {
  access_token: string;
  expires_in?: number | null;
  [key: string]: unknown;
};

type StoredSession = {
  accessToken: string | null;
  expiresAt: number | null;
  userData: string | null;
};

export class AuthSessionExpiredError extends Error {
  constructor(message = "Session expired") {
    super(message);
    this.name = "AuthSessionExpiredError";
  }
}

function decodeBase64UrlSegment(value: string): string | null {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  let buffer = 0;
  let bits = 0;
  let output = "";

  for (const character of padded) {
    if (character === "=") {
      break;
    }

    const index = BASE64_ALPHABET.indexOf(character);
    if (index === -1) {
      return null;
    }

    buffer = (buffer << 6) | index;
    bits += 6;

    while (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}

function getJwtExpiryMs(accessToken: string): number | null {
  const segments = accessToken.split(".");
  if (segments.length < 2) {
    return null;
  }

  const payloadJson = decodeBase64UrlSegment(segments[1]);
  if (!payloadJson) {
    return null;
  }

  try {
    const payload = JSON.parse(payloadJson) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function getFallbackExpiryMs(expiresIn?: number | null): number | null {
  return typeof expiresIn === "number" && Number.isFinite(expiresIn)
    ? Date.now() + expiresIn * 1000
    : null;
}

function resolveExpiresAtMs(payload: PersistedAuthPayload): number | null {
  const jwtExpiryMs = getJwtExpiryMs(payload.access_token);
  const fallbackExpiryMs = getFallbackExpiryMs(payload.expires_in);

  if (jwtExpiryMs && fallbackExpiryMs) {
    return Math.min(jwtExpiryMs, fallbackExpiryMs);
  }

  return jwtExpiryMs ?? fallbackExpiryMs;
}

export function isExpired(
  expiresAt: number | null | undefined,
  now = Date.now(),
): boolean {
  if (!expiresAt) {
    return true;
  }

  return now >= expiresAt - EXPIRY_SKEW_MS;
}

export async function readStoredSession(): Promise<StoredSession> {
  const entries = await AsyncStorage.multiGet([
    ACCESS_TOKEN_KEY,
    USER_DATA_KEY,
    TOKEN_EXPIRES_AT_KEY,
  ]);

  const storedValues = Object.fromEntries(entries);
  const expiresAtRaw = storedValues[TOKEN_EXPIRES_AT_KEY];
  const expiresAt = expiresAtRaw ? Number.parseInt(expiresAtRaw, 10) : null;

  return {
    accessToken: storedValues[ACCESS_TOKEN_KEY] ?? null,
    userData: storedValues[USER_DATA_KEY] ?? null,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
  };
}

export async function clearStoredAuth(): Promise<void> {
  await AsyncStorage.multiRemove([
    ACCESS_TOKEN_KEY,
    USER_DATA_KEY,
    TOKEN_EXPIRES_AT_KEY,
  ]);
}

export async function persistAuthSession(
  payload: PersistedAuthPayload,
): Promise<number> {
  const expiresAt = resolveExpiresAtMs(payload);
  if (!expiresAt) {
    throw new Error("Unable to determine token expiry");
  }

  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, payload.access_token],
    [USER_DATA_KEY, JSON.stringify(payload)],
    [TOKEN_EXPIRES_AT_KEY, expiresAt.toString()],
  ]);

  return expiresAt;
}

export async function getValidAccessToken(): Promise<string | null> {
  const session = await readStoredSession();
  if (!session.accessToken || isExpired(session.expiresAt)) {
    await clearStoredAuth();
    return null;
  }

  return session.accessToken;
}
