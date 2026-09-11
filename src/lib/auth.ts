// Shared-password access control.
//
// There are no user accounts: one password opens the app. The cookie holds an
// HMAC of a fixed marker plus an expiry — never the password itself — so a
// stolen cookie reveals nothing and cannot be forged without SESSION_SECRET.
//
// Web Crypto rather than node:crypto, so the same code runs in proxy.ts
// (which may execute on the Edge runtime) and in server actions.

const COOKIE_NAME = "scorecard_session";
const SESSION_MARKER = "authenticated";
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

export async function checkPassword(candidate: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    throw new Error(
      "APP_PASSWORD is not set. Add it to your environment — see .env.example."
    );
  }
  // Hash both sides first so the comparison is over equal-length strings and
  // cannot leak the password's length.
  const [a, b] = await Promise.all([sign(candidate), sign(expected)]);
  return timingSafeEqual(a, b);
}

/** A signed "<expiry>.<hmac>" token. */
export async function createSessionToken(now: Date = new Date()): Promise<string> {
  const expiresAt = now.getTime() + SESSION_MAX_AGE * 1000;
  const payload = `${SESSION_MARKER}.${expiresAt}`;
  return `${expiresAt}.${await sign(payload)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  now: Date = new Date()
): Promise<boolean> {
  if (!token) return false;
  const [expiresRaw, signature] = token.split(".");
  if (!expiresRaw || !signature) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < now.getTime()) return false;

  const expected = await sign(`${SESSION_MARKER}.${expiresAt}`);
  return timingSafeEqual(signature, expected);
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_MAX_AGE,
  secure: process.env.NODE_ENV === "production",
} as const;
