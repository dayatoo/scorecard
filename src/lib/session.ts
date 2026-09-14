// Server-only helpers that read the session cookie and load the signed-in
// user. Kept apart from auth.ts so the token-signing there stays importable
// from proxy.ts, which has no `cookies()` and never touches the database.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { prisma } from "./prisma";
import { SESSION_COOKIE, verifySessionToken } from "./auth";

export type CurrentUser = {
  id: string;
  username: string;
  role: "MEMBER" | "ADMIN";
  departmentId: string;
};

/**
 * Re-reads the User row on every call — never trusts anything beyond the
 * userId out of the token — so a since-removed or since-unapproved account
 * stops working the moment its cookie is next used, not just at next login.
 *
 * `cache()` only dedupes repeat calls within one request's render (e.g. the
 * root layout and a page both calling this for the same navigation) — it
 * does not carry over between requests, so that guarantee still holds.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const verified = await verifySessionToken(token);
  if (!verified) return null;

  const user = await prisma.user.findUnique({ where: { id: verified.userId } });
  if (!user || user.status !== "APPROVED") return null;

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    departmentId: user.departmentId,
  };
});

export async function isAuthenticated(): Promise<boolean> {
  return (await getCurrentUser()) !== null;
}

/**
 * Call at the top of every server action that mutates data. The proxy already
 * redirects unauthenticated page requests, but an action is a POST endpoint
 * reachable without going through the UI, so it needs its own check.
 */
export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  return user;
}

/** Same, for pages — redirects rather than throwing. */
export async function requireAuthPage(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireAuth();
  if (user.role !== "ADMIN") throw new Error("Admins only.");
  return user;
}

export async function requireAdminPage(): Promise<CurrentUser> {
  const user = await requireAuthPage();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
