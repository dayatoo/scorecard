// Session token signing.
//
// A session proves who is signed in: the cookie holds an HMAC of a userId
// plus an expiry, never a password. A stolen cookie reveals a userId (already
// visible in the app once signed in) but cannot be forged or extended without
// SESSION_SECRET.
//
// Web Crypto rather than node:crypto, so the same code runs in proxy.ts
// (which may execute on the Edge runtime) and in server actions.

const COOKIE_NAME = "scorecard_session";
const SESSION_DAYS = 30;

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error(
      "SESSION_SECRET is not set. Add it to your environment — see .env.example."
    );
  }
  return value;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return toHex(signature);
}

/** Constant-time comparison, so a mismatch leaks nothing through timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** HMAC of arbitrary text, hex-encoded. Reused as the rate limiter's IP hash. */
export async function signText(value: string): Promise<string> {
  return sign(value);
}

/** A signed "<userId>.<expiry>.<hmac>" token. */
export async function createSessionToken(
  userId: string,
  now: Date = new Date()
): Promise<string> {
  const expiresAt = now.getTime() + SESSION_MAX_AGE * 1000;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  now: Date = new Date()
): Promise<{ userId: string } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresRaw, signature] = parts;
  if (!userId || !expiresRaw || !signature) return null;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < now.getTime()) return null;

  const expected = await sign(`${userId}.${expiresAt}`);
  return timingSafeEqual(signature, expected) ? { userId } : null;
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_MAX_AGE,
  secure: process.env.NODE_ENV === "production",
} as const;
