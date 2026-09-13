"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { attempt, type ActionResult } from "./result";

async function assertNotLastAdmin(userId: string): Promise<void> {
  const target = await prisma.user.findUnique({ where: { id: userId } });
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

/** Rejecting a pending registration is a plain delete — no "rejected" state to manage. */
export async function removeUser(userId: string): Promise<ActionResult> {
  return attempt(async () => {
    await requireAdmin();
    await assertNotLastAdmin(userId);
    await prisma.user.delete({ where: { id: userId } });
    revalidatePath("/manage/users");
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
