"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmSaveDialog } from "@/components/ConfirmSaveDialog";
import { restoreFiscalYearFromHolding } from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/result";

type HeldYear = {
  id: string;
  label: string;
  kpiCount: number;
  heldAt: string;
  heldBy: string | null;
  purgeAt: string;
};

export function HoldingClient({ heldYears }: { heldYears: HeldYear[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<HeldYear | null>(null);

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setError(null);
        router.refresh();
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
      }
    });

  return (
    <section className="rounded-lg border bg-white">
      <ul className="divide-y">
        {heldYears.map((fy) => (
          <li key={fy.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div>
              <span className="font-medium">{fy.label}</span>
              <span className="ml-2 text-xs text-gray-500">
                {fy.kpiCount} KPI{fy.kpiCount === 1 ? "" : "s"} · held by{" "}
                {fy.heldBy ?? "an admin"} on {formatDateTime(fy.heldAt)}
              </span>
              <div className="mt-0.5 text-xs font-medium text-amber-700">
                {describeExpiry(fy.purgeAt)}
              </div>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => setRestoring(fy)}
              className="rounded border border-gray-300 px-2.5 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Restore
            </button>
          </li>
        ))}
        {heldYears.length === 0 && (
          <li className="px-5 py-4 text-sm text-gray-500">Nothing is in holding right now.</li>
        )}
      </ul>
      {error && <p className="px-5 py-3 text-sm font-medium text-rose-700">{error}</p>}

      <ConfirmSaveDialog
        open={restoring !== null}
        isSaving={pending}
        title={`Restore ${restoring?.label}?`}
        changes={
          restoring
            ? [
                {
                  field: "year",
                  label: restoring.label,
                  from: "in holding",
                  to: "restored — visible and editable again",
                },
              ]
            : []
        }
        onCancel={() => setRestoring(null)}
        onConfirm={() => {
          const target = restoring;
          setRestoring(null);
          if (target) run(() => restoreFiscalYearFromHolding(target.id));
        }}
      />
    </section>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describeExpiry(purgeAtIso: string): string {
  const msLeft = new Date(purgeAtIso).getTime() - Date.now();
  if (msLeft <= 0) return "Expires shortly — will be permanently deleted on the next admin page load.";
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  return `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — permanently deleted after that.`;
}
