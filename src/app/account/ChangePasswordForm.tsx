"use client";

import { useActionState } from "react";

import { changePassword, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = { error: null, done: false };

const inputClass =
  "mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

export function ChangePasswordForm({ username }: { username: string }) {
  const [state, formAction, pending] = useActionState(changePassword, initialState);

  return (
    <form action={formAction} className="space-y-3">
      {/* Lets password managers pair the new password with this account. */}
      <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />

      <div>
        <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-gray-500">At least 8 characters.</p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-rose-700">
          {state.error}
        </p>
      )}
      {state.done && !state.error && (
        <p role="status" className="text-sm font-medium text-emerald-700">
          Password changed. You&apos;ve been signed out everywhere else.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
