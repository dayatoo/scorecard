"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { ConfirmSaveDialog } from "@/components/ConfirmSaveDialog";
import { createKpi, deleteKpi, moveKpi, reorderKpi } from "@/app/actions/hierarchy";

type Node = {
  id: string;
  code: string;
  name: string;
  level: number;
  parentId: string | null;
  isLeaf: boolean;
  weight: number;
  globalWeight: number;
};

export function HierarchyEditor({
  fiscalYears,
  selectedFiscalYearId,
  fiscalYearClosed = false,
  nodes,
}: {
  fiscalYears: { id: string; label: string }[];
  selectedFiscalYearId: string;
  fiscalYearClosed?: boolean;
  nodes: Node[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addingUnder, setAddingUnder] = useState<string | null | "ROOT">(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Node | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, Node[]>();
    for (const n of nodes) {
      const list = map.get(n.parentId) ?? [];
      list.push(n);
      map.set(n.parentId, list);
    }
    return map;
  }, [nodes]);

  const descendantsOf = (id: string): Set<string> => {
    const out = new Set<string>();
    const walk = (nodeId: string) => {
      for (const child of childrenOf.get(nodeId) ?? []) {
        out.add(child.id);
        walk(child.id);
      }
    };
    walk(id);
    return out;
  };

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error ?? "Something went wrong.");
          return;
        }
        setError(null);
        router.refresh();
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
      }
    });

  const groupTotal = (parentId: string | null) =>
    (childrenOf.get(parentId) ?? []).reduce((sum, n) => sum + n.weight, 0);

  const submitAdd = () => {
    if (addingUnder === null) return;
    const parentId = addingUnder === "ROOT" ? null : addingUnder;
    run(async () => {
      const result = await createKpi({
        fiscalYearId: selectedFiscalYearId,
        parentId,
        code: newCode,
        name: newName,
      });
      if (result.ok) {
        setAddingUnder(null);
        setNewCode("");
        setNewName("");
      }
      return result;
    });
  };

  const renderRow = (node: Node): React.ReactNode => {
    const children = childrenOf.get(node.id) ?? [];
    const siblings = childrenOf.get(node.parentId) ?? [];
    const index = siblings.findIndex((s) => s.id === node.id);
    const excludedForMove = new Set([node.id, ...descendantsOf(node.id)]);

    return (
      <li key={node.id}>
        <div
          className="flex flex-wrap items-center gap-2 border-b py-1.5 text-sm last:border-0"
          style={{ paddingLeft: `${(node.level - 1) * 1.25}rem` }}
        >
          <span className="font-mono text-xs text-gray-400">{node.code}</span>
          <Link href={`/kpi/${node.id}`} className="hover:text-blue-700 hover:underline">
            {node.name}
          </Link>
          <span className="tabular ml-auto text-xs text-gray-500">
            {node.weight.toFixed(1)}% of group · {node.globalWeight.toFixed(1)}% global
          </span>
          {!fiscalYearClosed && (
            <div className="flex items-center gap-1">
              <button type="button" className="rounded border px-1.5 py-0.5 text-xs hover:bg-gray-50" disabled={pending}
                onClick={() => run(() => reorderKpi({ kpiId: node.id, direction: "up" }))}
                aria-label={`Move ${node.name} up`} title="Move up" hidden={index <= 0}
              >↑</button>
              <button type="button" className="rounded border px-1.5 py-0.5 text-xs hover:bg-gray-50" disabled={pending}
                onClick={() => run(() => reorderKpi({ kpiId: node.id, direction: "down" }))}
                aria-label={`Move ${node.name} down`} title="Move down" hidden={index >= siblings.length - 1}
              >↓</button>
              <button type="button" className="rounded border px-2 py-0.5 text-xs hover:bg-gray-50"
                aria-label={`Add a sub-KPI under ${node.name}`}
                onClick={() => setAddingUnder(node.id)}
              >+ sub</button>
              <button type="button" className="rounded border px-2 py-0.5 text-xs hover:bg-gray-50"
                aria-label={`Move ${node.name} under a different parent`}
                onClick={() => setMovingId(movingId === node.id ? null : node.id)}
              >Move</button>
              <button type="button" className="rounded border border-rose-200 px-2 py-0.5 text-xs text-rose-700 hover:bg-rose-50"
                aria-label={`Delete ${node.name}`}
                onClick={() => setConfirmDelete(node)}
              >Delete</button>
            </div>
          )}
        </div>

        {movingId === node.id && (
          <div className="ml-4 flex items-center gap-2 border-b py-2 text-sm">
            <span className="text-xs text-gray-500">Move under</span>
            <select
              className="rounded border border-gray-300 px-2 py-1 text-sm"
              defaultValue=""
              onChange={(e) => {
                const newParentId = e.target.value === "ROOT" ? null : e.target.value || null;
                if (e.target.value === "") return;
                setMovingId(null);
                run(() => moveKpi({ kpiId: node.id, newParentId }));
              }}
            >
              <option value="" disabled>Choose a new parent…</option>
              <option value="ROOT">Top level (a Strategic Goal)</option>
              {nodes
                .filter((n) => !excludedForMove.has(n.id) && n.id !== node.parentId)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {"— ".repeat(n.level - 1)}{n.code} {n.name}
                  </option>
                ))}
            </select>
            <button type="button" className="text-xs text-gray-500 hover:underline" onClick={() => setMovingId(null)}>
              Cancel
            </button>
          </div>
        )}

        {addingUnder === node.id && (
          <div className="ml-4 flex flex-wrap items-center gap-2 border-b py-2">
            <input
              className="w-28 rounded border border-gray-300 px-2 py-1 text-sm font-mono"
              placeholder="Code"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
            />
            <input
              className="min-w-48 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="button" disabled={pending} onClick={submitAdd}
              className="rounded bg-blue-600 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >Add</button>
            <button type="button" className="text-xs text-gray-500 hover:underline"
              onClick={() => { setAddingUnder(null); setNewCode(""); setNewName(""); }}
            >Cancel</button>
          </div>
        )}

        {children.length > 0 && (
          <>
            <div
              className="border-b py-1 text-xs text-gray-400"
              style={{ paddingLeft: `${node.level * 1.25}rem` }}
            >
              Sub-KPIs total {groupTotal(node.id).toFixed(2)}%
              {Math.abs(groupTotal(node.id) - 100) > 0.01 && " — not 100%"}
            </div>
            <ul>{children.map(renderRow)}</ul>
          </>
        )}
      </li>
    );
  };

  const roots = childrenOf.get(null) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          <span className="mr-2 text-xs font-medium text-gray-700">Fiscal year</span>
          <select
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            value={selectedFiscalYearId}
            onChange={(e) => router.push(`/manage/hierarchy?fy=${e.target.value}`)}
          >
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>{fy.label}</option>
            ))}
          </select>
        </label>
        {!fiscalYearClosed && (
          <button
            type="button"
            onClick={() => setAddingUnder("ROOT")}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            + Strategic Goal
          </button>
        )}
      </div>

      {fiscalYearClosed && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700">
          This year is closed. An admin can reopen it to make changes.
        </p>
      )}

      {error && <p className="text-sm font-medium text-rose-700">{error}</p>}

      <div className="rounded-lg border bg-white px-4 py-3">
        <div className="mb-2 text-xs text-gray-500">
          Strategic Goals total {groupTotal(null).toFixed(2)}%
          {Math.abs(groupTotal(null) - 100) > 0.01 && " — not 100%"}
        </div>

        {addingUnder === "ROOT" && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded border bg-gray-50 px-2 py-2">
            <input
              className="w-28 rounded border border-gray-300 px-2 py-1 text-sm font-mono"
              placeholder="Code"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
            />
            <input
              className="min-w-48 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="button" disabled={pending} onClick={submitAdd}
              className="rounded bg-blue-600 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >Add</button>
            <button type="button" className="text-xs text-gray-500 hover:underline"
              onClick={() => { setAddingUnder(null); setNewCode(""); setNewName(""); }}
            >Cancel</button>
          </div>
        )}

        {roots.length === 0 ? (
          <p className="text-sm text-gray-500">No KPIs yet — add a Strategic Goal to get started.</p>
        ) : (
          <ul>{roots.map(renderRow)}</ul>
        )}
      </div>

      <ConfirmSaveDialog
        open={confirmDelete !== null}
        isSaving={pending}
        title={`Delete ${confirmDelete?.name}?`}
        changes={
          confirmDelete
            ? [
                {
                  field: "kpi",
                  label: confirmDelete.name,
                  from: confirmDelete.isLeaf ? "this KPI and its recorded figures" : "this KPI and every sub-KPI beneath it",
                  to: "permanently deleted",
                },
              ]
            : []
        }
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (target) run(() => deleteKpi({ kpiId: target.id }));
        }}
      />
    </div>
  );
}
