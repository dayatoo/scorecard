"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatDate } from "@/lib/dates";
import { approveUser, removeUser, setUserRole } from "@/app/actions/users";

type UserRow = {
  id: string;
  username: string;
  department: string;
  role: "MEMBER" | "ADMIN";
  status: "PENDING" | "APPROVED";
  createdAt: string;
};

export function UsersClient({
  currentUserId,
  users,
}: {
  currentUserId: string;
  users: UserRow[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (id: string, action: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        setBusyId(null);
        return;
      }
      router.refresh();
    });
  };

  const pending = users.filter((u) => u.status === "PENDING");
  const approved = users.filter((u) => u.status === "APPROVED");

  const busy = (id: string) => isPending && busyId === id;

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      <section className="rounded-lg border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Pending registrations</h2>
        </div>
        {pending.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-500">Nothing waiting on approval.</p>
        ) : (
          <ul className="divide-y">
            {pending.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <span className="font-medium text-gray-900">{u.username}</span>
                  <span className="ml-2 text-sm text-gray-500">{u.department}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    registered {formatDate(new Date(u.createdAt))}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy(u.id)}
                    onClick={() => run(u.id, () => removeUser(u.id))}
                    className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    disabled={busy(u.id)}
                    onClick={() => run(u.id, () => approveUser(u.id))}
                    className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Approved users</h2>
        </div>
        <ul className="divide-y">
          {approved.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <span className="font-medium text-gray-900">{u.username}</span>
                <span className="ml-2 text-sm text-gray-500">{u.department}</span>
                {u.id === currentUserId && (
                  <span className="ml-2 text-xs text-gray-400">(you)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy(u.id)}
                  onClick={() =>
                    run(u.id, () => setUserRole(u.id, u.role === "ADMIN" ? "MEMBER" : "ADMIN"))
                  }
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {u.role === "ADMIN" ? "Make member" : "Make admin"}
                </button>
                <button
                  type="button"
                  disabled={busy(u.id)}
                  onClick={() => run(u.id, () => removeUser(u.id))}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Remove
                </button>
                <span className="w-16 text-right text-xs font-medium text-gray-500 uppercase">
                  {u.role}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
