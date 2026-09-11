"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  checkPassword,
  createSessionToken,
} from "@/lib/auth";

export type SignInState = { error: string | null };

export async function signIn(
  _previous: SignInState,
  formData: FormData
): Promise<SignInState> {
  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "Enter the password." };

  let ok = false;
  try {
    ok = await checkPassword(password);
  } catch (cause) {
    // A missing APP_PASSWORD is a deployment problem, not a wrong password —
    // say so plainly rather than leaving someone guessing at the password.
    return {
      error: cause instanceof Error ? cause.message : "Sign-in is not configured.",
    };
  }

  if (!ok) return { error: "That password is not correct." };

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(), SESSION_COOKIE_OPTIONS);

  const next = String(formData.get("next") ?? "/");
  // Only ever return to a path on this app, never to a supplied absolute URL.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}
