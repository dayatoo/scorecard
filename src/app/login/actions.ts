"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
  signText,
} from "@/lib/auth";

export type SignInState = { error: string | null };

export async function signIn(
  _previous: SignInState,
  formData: FormData
): Promise<SignInState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password." };

  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
  });

  if (!user) return { error: "That username does not exist." };
  if (user.status !== "APPROVED") {
    return { error: "Your account is pending admin approval." };
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return { error: "That password is not correct." };

  (await cookies()).set(
    SESSION_COOKIE,
    await createSessionToken(user.id),
    SESSION_COOKIE_OPTIONS
  );

  const next = String(formData.get("next") ?? "/");
  // Only ever return to a path on this app, never to a supplied absolute URL.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export type UsernameStatus = "not_found" | "pending" | "approved" | "rate_limited";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;
const RATE_LIMIT_CLEANUP_MS = 5 * 60_000;

/**
 * Live status for the login form's username indicator. Kept deliberately
 * informative (does the account exist / is it approved) even though that's a
 * classic enumeration risk, because there's no email address to notify
 * anyone any other way — so it's rate-limited per (hashed) IP instead.
 */
export async function checkUsernameStatus(username: string): Promise<UsernameStatus> {
  const trimmed = username.trim();
  if (trimmed.length < 1) return "not_found";

  const forwardedFor = (await headers()).get("x-forwarded-for") ?? "unknown";
  const ip = forwardedFor.split(",")[0]!.trim();
  const ipHash = await signText(ip);

  const cutoff = new Date(Date.now() - RATE_LIMIT_CLEANUP_MS);
  // Opportunistic cleanup — cheap, keeps the table small without a separate job.
  await prisma.usernameCheckAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } });

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const recentCount = await prisma.usernameCheckAttempt.count({
    where: { ipHash, createdAt: { gte: windowStart } },
  });
  if (recentCount >= RATE_LIMIT_MAX_ATTEMPTS) return "rate_limited";

  await prisma.usernameCheckAttempt.create({ data: { ipHash } });

  const user = await prisma.user.findFirst({
    where: { username: { equals: trimmed, mode: "insensitive" } },
    select: { status: true },
  });
  if (!user) return "not_found";
  return user.status === "APPROVED" ? "approved" : "pending";
}
