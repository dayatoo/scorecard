"use client";

import { useActionState, useRef, useState } from "react";

import { checkUsernameStatus, signIn, type SignInState, type UsernameStatus } from "./actions";

const initialState: SignInState = { error: null };

function StatusIcon({ status }: { status: UsernameStatus | "idle" | "checking" }) {
  if (status === "idle" || status === "checking") return null;
  if (status === "approved") {
    return (
      <span title="Account approved — you can sign in" className="text-emerald-600">
        ✓
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span title="Account pending admin approval" className="text-amber-600">
        ⏱
      </span>
    );
  }
  if (status === "rate_limited") return null;
  return (
    <span title="No account with that username" className="text-rose-600">
      ✗
    </span>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [username, setUsername] = useState("");
  const [result, setResult] = useState<UsernameStatus | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const status: UsernameStatus | "idle" | "checking" =
    username.trim().length < 3 ? "idle" : (result ?? "checking");

  const onUsernameChange = (value: string) => {
    setUsername(value);
    setResult(null);
    clearTimeout(debounceRef.current);
    if (value.trim().length < 3) return;
    debounceRef.current = setTimeout(() => {
      checkUsernameStatus(value).then(setResult).catch(() => setResult(null));
    }, 400);
  };

  return (
    <form action={formAction} className="mt-5 space-y-3">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-700">
          Username
        </label>
        <div className="relative mt-1">
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            autoFocus
            required
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-sm">
            <StatusIcon status={status} />
          </span>
        </div>
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-rose-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
