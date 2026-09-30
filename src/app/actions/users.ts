"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { generateTemporaryPassword } from "@/lib/accounts";
import { clearLoginFailures } from "@/lib/login-throttle";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { attempt, type ActionResult } from "./result";

async function assertNotLastAdmin(userId: string): Promise<void> {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target || target.role !== "ADMIN") return;
  const adminCount = await prisma.user.count({ where: { role: "ADMIN", status: "APPROVED" } });
  if (adminCount <= 1) {
    throw new Error("That's the only admin — promote someone else first.");
  }
}

export async function approveUser(userId: string): Promise<ActionResult> {
  return attempt(async () => {
    await requireAdmin();
    await prisma.user.update({ where: { id: userId }, data: { status: "APPROVED" } });
    revalidatePath("/manage/users");
  });
}

/**
 * Rejecting a pending registration is a plain delete — no "rejected" state to
 * manage. An account that authored score overrides or change proposals can't
 * be deleted, since those records must keep naming who made them; resetting
 * its password is the way to lock it out instead.
 */
export async function removeUser(userId: string): Promise<ActionResult> {
  return attempt(async () => {
    await requireAdmin();
    await assertNotLastAdmin(userId);
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { _count: { select: { scoreOverrides: true, proposals: true } } },
    });
    if (!target) throw new Error("That user no longer exists.");
    const { scoreOverrides, proposals } = target._count;
    if (scoreOverrides > 0 || proposals > 0) {
      const records = [
        scoreOverrides > 0 ? `${scoreOverrides} score override${scoreOverrides === 1 ? "" : "s"}` : null,
        proposals > 0 ? `${proposals} change proposal${proposals === 1 ? "" : "s"}` : null,
      ]
        .filter(Boolean)
        .join(" and ");
      throw new Error(
        `This account made ${records}, which must keep their author, so it can't be removed. Use "Reset password" to lock it out instead.`
      );
    }
    await prisma.user.delete({ where: { id: userId } });
    revalidatePath("/manage/users");
  });
}

/**
 * Sets a random temporary password for another user and signs them out
 * everywhere. The password is returned once, for the admin to pass on; the
 * user should change it from their account page after signing in.
 */
export async function resetUserPassword(
  userId: string
): Promise<ActionResult<{ username: string; temporaryPassword: string }>> {
  return attempt(async () => {
    const admin = await requireAdmin();
    if (userId === admin.id) {
      throw new Error("Change your own password from your account page instead.");
    }
    const temporaryPassword = generateTemporaryPassword();
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(temporaryPassword, 10),
        sessionVersion: { increment: 1 },
      },
      select: { username: true },
    });
    await clearLoginFailures(updated.username);
    return { username: updated.username, temporaryPassword };
  });
}

export async function setUserRole(userId: string, role: "MEMBER" | "ADMIN"): Promise<ActionResult> {
  return attempt(async () => {
    await requireAdmin();
    if (role === "MEMBER") await assertNotLastAdmin(userId);
    await prisma.user.update({ where: { id: userId }, data: { role } });
    revalidatePath("/manage/users");
  });
}
