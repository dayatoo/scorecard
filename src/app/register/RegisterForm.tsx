"use client";

import { useActionState, useState } from "react";

import { register, type RegisterState } from "./actions";

const initialState: RegisterState = { error: null, pending: false };

function ConsentModal({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState(false);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
              />
            </svg>
          </div>
          <div>
            <h2 id="consent-title" className="text-base font-semibold text-gray-900">
              Before you register
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
              No personal information including your email address will be asked for
              this service. Please use a unique username and password. Using the same
              username or password from other websites puts your data at risk.
            </p>
          </div>
        </div>

        <label className="mt-5 flex items-start gap-2.5 rounded border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>I understand and agree to these terms</span>
        </label>

        <button
          type="button"
          disabled={!checked}
          onClick={onAccept}
          className="mt-4 w-full rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          I Understand, Continue
        </button>
      </div>
    </div>
  );
}

export function RegisterForm({
  departments,
}: {
  departments: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(register, initialState);
  const [consented, setConsented] = useState(false);

  if (state.pending) {
    return (
      <p className="mt-5 text-sm text-gray-700">
        Your account has been created and is pending admin approval. You&apos;ll be
        able to sign in once an admin approves it.
      </p>
    );
  }

  return (
    <>
      {!consented && <ConsentModal onAccept={() => setConsented(true)} />}
      <form action={formAction} className="mt-5 space-y-3" inert={!consented}>
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-700">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoFocus
          required
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="departmentId" className="block text-sm font-medium text-gray-700">
          Department
        </label>
        <select
          id="departmentId"
          name="departmentId"
          required
          defaultValue=""
          className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="" disabled>
            Select a department
          </option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="companyIdNumber" className="block text-sm font-medium text-gray-700">
          Company ID number
        </label>
        <input
          id="companyIdNumber"
          name="companyIdNumber"
          type="text"
          required
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
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
        disabled={pending || !consented}
        className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Creating account…" : "Register"}
      </button>
      </form>
    </>
  );
}
