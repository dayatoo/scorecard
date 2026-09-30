// Session token signing.
//
// A session proves who is signed in: the cookie holds an HMAC of a userId,
// the user's session version and an expiry, never a password. A stolen
// cookie reveals a userId (already visible in the app once signed in) but
// cannot be forged or extended without SESSION_SECRET, and a password change
// or reset revokes it.
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

/**
 * A signed "<userId>.<sessionVersion>.<expiry>.<hmac>" token. The version is
 * checked against the User row on every request (see session.ts), so bumping
 * it revokes every token issued before — the signature alone can't do that.
 */
export async function createSessionToken(
  userId: string,
  sessionVersion: number,
  now: Date = new Date()
): Promise<string> {
  const expiresAt = now.getTime() + SESSION_MAX_AGE * 1000;
  const payload = `${userId}.${sessionVersion}.${expiresAt}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  now: Date = new Date()
): Promise<{ userId: string; sessionVersion: number } | null> {
  if (!token) return null;
  const parts = token.split(".");
  // Three parts is the format issued before session versions existed; it
  // stays valid as version 0 until that user's version is first bumped.
  if (parts.length !== 3 && parts.length !== 4) return null;
  const [userId, versionRaw, expiresRaw, signature] =
    parts.length === 4 ? parts : [parts[0], "0", parts[1], parts[2]];
  if (!userId || !versionRaw || !expiresRaw || !signature) return null;

  const sessionVersion = Number(versionRaw);
  if (!Number.isInteger(sessionVersion) || sessionVersion < 0) return null;
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < now.getTime()) return null;

  const payload =
    parts.length === 4 ? `${userId}.${sessionVersion}.${expiresAt}` : `${userId}.${expiresAt}`;
  const expected = await sign(payload);
  return timingSafeEqual(signature, expected) ? { userId, sessionVersion } : null;
}

/**
 * Whether the session cookie is marked Secure (sent over HTTPS only).
 * Defaults to on in production. SESSION_COOKIE_SECURE=false turns it off for
 * a production build served over plain HTTP, such as an office-only server
 * without a certificate, where a Secure cookie would never be sent back and
 * nobody could stay signed in. SESSION_COOKIE_SECURE=true forces it on.
 */
export function sessionCookieSecure(env: NodeJS.ProcessEnv = process.env): boolean {
  const override = env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (override === "true" || override === "1") return true;
  if (override === "false" || override === "0") return false;
  return env.NODE_ENV === "production";
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_MAX_AGE,
  secure: sessionCookieSecure(),
} as const;
