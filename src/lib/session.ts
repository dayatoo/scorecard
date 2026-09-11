// Server-only helpers that read the session cookie. Kept apart from auth.ts so
// the crypto there stays importable from proxy.ts, which has no `cookies()`.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, verifySessionToken } from "./auth";

export async function isAuthenticated(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/**
 * Call at the top of every server action that mutates data. The proxy already
 * redirects unauthenticated page requests, but an action is a POST endpoint
 * reachable without going through the UI, so it needs its own check.
 */
export async function requireAuth(): Promise<void> {
  if (!(await isAuthenticated())) {
    throw new Error("Not signed in.");
  }
}

/** Same, for pages — redirects rather than throwing. */
export async function requireAuthPage(): Promise<void> {
  if (!(await isAuthenticated())) redirect("/login");
}
