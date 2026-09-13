"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
} from "@/lib/auth";

export type RegisterState = {
  error: string | null;
  pending: boolean;
};

const BCRYPT_ROUNDS = 10;

export async function register(
  _previous: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const username = String(formData.get("username") ?? "").trim();
  const departmentId = String(formData.get("departmentId") ?? "").trim();
  const companyIdNumber = String(formData.get("companyIdNumber") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!username || !departmentId || !companyIdNumber || !password) {
    return { error: "Fill in every field.", pending: false };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match.", pending: false };
  }
  if (password.length < 8) {
    return { error: "Passwords must be at least 8 characters.", pending: false };
  }

  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) return { error: "Choose a department.", pending: false };

  const [existingUsername, existingCompanyId] = await Promise.all([
    prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
    }),
    prisma.user.findFirst({
      where: { companyIdNumber: { equals: companyIdNumber, mode: "insensitive" } },
    }),
  ]);
  if (existingUsername) {
    return { error: "That username is already taken.", pending: false };
  }
  if (existingCompanyId) {
    return { error: "That company ID number is already registered.", pending: false };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Counting and creating inside one transaction avoids two people racing to
  // both become the first (auto-admin) account.
  const created = await prisma.$transaction(async (tx) => {
    const userCount = await tx.user.count();
    const isFirstUser = userCount === 0;
    return tx.user.create({
      data: {
        username,
        passwordHash,
        companyIdNumber,
        departmentId,
        role: isFirstUser ? "ADMIN" : "MEMBER",
        status: isFirstUser ? "APPROVED" : "PENDING",
      },
    });
  });

  if (created.status === "APPROVED") {
    (await cookies()).set(
      SESSION_COOKIE,
      await createSessionToken(created.id),
      SESSION_COOKIE_OPTIONS
    );
    redirect("/");
  }

  return { error: null, pending: true };
}
