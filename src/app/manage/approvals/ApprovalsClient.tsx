"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatDate } from "@/lib/dates";
import { approveProposal, rejectProposal } from "@/app/actions/proposals";

type Proposal = {
  id: string;
  kpiId: string;
  kpiName: string;
  kpiCode: string;
  proposedByUsername: string;
  createdAt: string;
  summary: { field: string; label: string; from: string; to: string }[];
};

export function ApprovalsClient({ proposals }: { proposals: Proposal[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const approve = (id: string) => {
    setPendingId(id);
    setError(null);
    startTransition(async () => {
      const result = await approveProposal(id);
      if (!result.ok) {
        setError(result.error);
        setPendingId(null);
        return;
      }
      router.refresh();
    });
  };

  const reject = (id: string) => {
    if (!confirm("Reject this proposal? Nothing on the KPI will change.")) return;
    setPendingId(id);
    setError(null);
    startTransition(async () => {
      const result = await rejectProposal(id);
      if (!result.ok) {
        setError(result.error);
        setPendingId(null);
        return;
      }
      router.refresh();
    });
  };

  if (proposals.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-6 text-sm text-gray-500">
        Nothing waiting on review.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm font-medium text-rose-700">
          {error}
        </p>
      )}
      {proposals.map((p) => (
        <div key={p.id} className="rounded-lg border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link href={`/kpi/${p.kpiId}`} className="font-medium text-gray-900 hover:text-blue-700 hover:underline">
                <span className="font-mono text-xs text-gray-400">{p.kpiCode}</span> {p.kpiName}
              </Link>
              <p className="mt-0.5 text-xs text-gray-500">
                Proposed by <span className="font-medium text-gray-700">{p.proposedByUsername}</span>{" "}
                on {formatDate(new Date(p.createdAt))}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => reject(p.id)}
                disabled={isPending && pendingId === p.id}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => approve(p.id)}
                disabled={isPending && pendingId === p.id}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending && pendingId === p.id ? "Working…" : "Approve"}
              </button>
            </div>
          </div>

          <ul className="mt-3 space-y-2 border-t pt-3">
            {p.summary.map((change) => (
              <li key={change.field} className="text-sm">
                <div className="font-medium text-gray-900">{change.label}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-gray-600">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 line-through decoration-gray-400">
                    {change.from}
                  </span>
                  <span aria-hidden>→</span>
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-900">
                    {change.to}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
