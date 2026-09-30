// Brute-force limit for password sign-in.
//
// Failed attempts are counted per username and per client IP over a rolling
// window. The per-username count is the real guard: it holds however many
// addresses an attacker spreads guesses across, and even when the forwarded
// IP header can be forged. The per-IP count catches one address sweeping
// many usernames. A successful sign-in, or an admin password reset, clears
// that username's count.

import "server-only";

import { headers } from "next/headers";

import { signText } from "./auth";
import { prisma } from "./prisma";

export const LOGIN_WINDOW_MS = 15 * 60_000;
export const MAX_FAILURES_PER_USERNAME = 5;
export const MAX_FAILURES_PER_IP = 30;

/**
 * The caller's IP as reported by the first proxy hop. Behind Vercel (or any
 * proxy that overwrites X-Forwarded-For) this is the real client; on a server
 * exposed directly it can be forged, which is why the username count above
 * never depends on it.
 */
export async function clientIp(): Promise<string> {
  const forwardedFor = (await headers()).get("x-forwarded-for") ?? "unknown";
  return forwardedFor.split(",")[0]!.trim() || "unknown";
}

async function keysFor(username: string, ip: string) {
  return {
    userKey: `u:${await signText(username.trim().toLowerCase())}`,
    ipKey: `ip:${await signText(ip)}`,
  };
}

/** True when either count has reached its limit inside the window. */
export async function isLoginThrottled(username: string, ip: string): Promise<boolean> {
  const { userKey, ipKey } = await keysFor(username, ip);
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  // Opportunistic cleanup keeps the table small without a scheduled job.
  await prisma.loginFailure.deleteMany({ where: { createdAt: { lt: since } } });
  const [byUser, byIp] = await Promise.all([
    prisma.loginFailure.count({ where: { key: userKey, createdAt: { gte: since } } }),
    prisma.loginFailure.count({ where: { key: ipKey, createdAt: { gte: since } } }),
  ]);
  return byUser >= MAX_FAILURES_PER_USERNAME || byIp >= MAX_FAILURES_PER_IP;
}

export async function recordLoginFailure(username: string, ip: string): Promise<void> {
  const { userKey, ipKey } = await keysFor(username, ip);
  await prisma.loginFailure.createMany({ data: [{ key: userKey }, { key: ipKey }] });
}

export async function clearLoginFailures(username: string): Promise<void> {
  const userKey = `u:${await signText(username.trim().toLowerCase())}`;
  await prisma.loginFailure.deleteMany({ where: { key: userKey } });
}
