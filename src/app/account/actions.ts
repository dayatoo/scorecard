"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

import { passwordProblem } from "@/lib/accounts";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, createSessionToken } from "@/lib/auth";
import {
  clearLoginFailures,
  clientIp,
  isLoginThrottled,
  recordLoginFailure,
} from "@/lib/login-throttle";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

export type ChangePasswordState = { error: string | null; done: boolean };

const BCRYPT_ROUNDS = 10;

/**
 * Changes the signed-in user's own password. Bumps their session version,
 * which signs out every other device, then re-issues this browser's cookie
 * at the new version so the person making the change stays signed in.
 */
export async function changePassword(
  _previous: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const currentUser = await requireAuth();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword) return { error: "Fill in every field.", done: false };

  // The current-password check shares sign-in's failure count, so a borrowed
  // session can't be used to guess the password at leisure.
  const ip = await clientIp();
  if (await isLoginThrottled(currentUser.username, ip)) {
    return {
      error: "Too many wrong passwords. Wait 15 minutes and try again, or ask an admin to reset your password.",
      done: false,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: { passwordHash: true },
  });
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    await recordLoginFailure(currentUser.username, ip);
    return { error: "Your current password is not correct.", done: false };
  }

  const problem = passwordProblem(newPassword);
  if (problem) return { error: problem, done: false };
  if (newPassword !== confirmPassword) return { error: "New passwords do not match.", done: false };
  if (newPassword === currentPassword) {
    return { error: "Choose a password different from your current one.", done: false };
  }

  const updated = await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
      sessionVersion: { increment: 1 },
    },
    select: { sessionVersion: true },
  });
  await clearLoginFailures(currentUser.username);

  (await cookies()).set(
    SESSION_COOKIE,
    await createSessionToken(currentUser.id, updated.sessionVersion),
    SESSION_COOKIE_OPTIONS
  );
  return { error: null, done: true };
}
