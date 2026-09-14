"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useOptimistic, useRef, useState, useTransition } from "react";

import { ConfirmSaveDialog } from "@/components/ConfirmSaveDialog";
import { createKpi, deleteKpi, moveKpi, reorderKpi } from "@/app/actions/hierarchy";
import { KpiEditPanel } from "./KpiEditPanel";

type Node = {
  id: string;
  code: string;
  name: string;
  subGroup: string | null;
  level: number;
  parentId: string | null;
  isLeaf: boolean;
  weight: number;
  globalWeight: number;
};

/**
 * Buckets siblings by `subGroup`, ordered by each label's first appearance —
 * a named label pulls its members together into one section even when
 * they're interleaved with others, while every unlabeled child shares one
 * "" bucket, rendered with no header, exactly like before this feature
 * existed.
 */
function clusterChildren(children: Node[]): { subGroup: string | null; items: Node[] }[] {
  const order: string[] = [];
  const buckets = new Map<string, Node[]>();
  for (const child of children) {
    const key = child.subGroup ?? "";
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(child);
  }
  return order.map((key) => ({ subGroup: key || null, items: buckets.get(key)! }));
}

/**
 * Tracks a continuous run of adds under one parent, entirely outside React
 * state: the next suggested number has to advance the instant a KPI is
 * submitted, not whenever the component next happens to re-render — a
 * fast typist can press Enter again before that render has landed, and a
 * value read from a stale closure would suggest the same number twice.
 */
type AddSession = { parentId: string | null; parentCode: string | null; nextNumber: number };

export function HierarchyEditor({
  fiscalYears,
  selectedFiscalYearId,
  fiscalYearClosed = false,
  nodes,
  departments,
  statusOptions,
}: {
  fiscalYears: { id: string; label: string }[];
  selectedFiscalYearId: string;
  fiscalYearClosed?: boolean;
  nodes: Node[];
  departments: { id: string; name: string }[];
  statusOptions: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Separate from the transition above so a burst of adds never disables the
  // reorder/move/delete buttons on unrelated rows.
  const [addPending, startAddTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addingUnder, setAddingUnder] = useState<string | null | "ROOT">(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Node | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const addSessionRef = useRef<AddSession | null>(null);

  // The list a KPI appears in the instant it's submitted, rather than once
  // the round trip that actually saves it comes back — see submitAdd.
  const [optimisticNodes, addOptimisticNode] = useOptimistic(
    nodes,
    (state: Node[], node: Node) => [...state, node]
  );

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, Node[]>();
    for (const n of optimisticNodes) {
      const list = map.get(n.parentId) ?? [];
      list.push(n);
      map.set(n.parentId, list);
    }
    return map;
  }, [optimisticNodes]);

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

  /** The "X totals to Y%" line for a group, colored red/green and linked to its weight page. */
  const renderBalanceLink = (parentId: string | null, label: string) => {
    const total = groupTotal(parentId);
    const balanced = Math.abs(total - 100) <= 0.01;
    return (
      <Link
        href={`/manage/hierarchy/weights/${parentId ?? "root"}`}
        className={`border-b py-1 text-xs block hover:underline ${
          balanced ? "font-bold text-emerald-700" : "font-bold text-rose-700"
        }`}
      >
        {label} totals to {total.toFixed(2)}%{!balanced && " - not 100%"}
      </Link>
    );
  };

  /** Opens the add row under `parentId` (or "ROOT") with the next code prefilled. */
  const openAdd = (parentId: string | null, target: string | "ROOT") => {
    const parentNode = parentId ? (optimisticNodes.find((n) => n.id === parentId) ?? null) : null;
    const nextNumber = (childrenOf.get(parentId) ?? []).length + 1;
    addSessionRef.current = { parentId, parentCode: parentNode?.code ?? null, nextNumber };
    setAddingUnder(target);
    setNewCode(parentNode ? `${parentNode.code}.${nextNumber}` : String(nextNumber));
    setNewName("");
    setError(null);
  };

  const closeAdd = () => {
    addSessionRef.current = null;
    setAddingUnder(null);
    setNewCode("");
    setNewName("");
  };

  /**
   * Saves the current row and, rather than closing it, immediately clears
   * and refocuses it for the next KPI at the same level — so a whole branch
   * can be typed in one continuous run of name-then-Enter.
   *
   * The new KPI appears in the list right away (an optimistic entry with
   * weight 0, exactly what it would have on the server until someone sets
   * it), while the actual save happens in the background: the next name can
   * be typed without waiting on a round trip that already succeeded once
   * before.
   */
  const submitAdd = () => {
    const session = addSessionRef.current;
    if (!session) return;

    const code = newCode.trim();
    const name = newName.trim();
    if (!code || !name) return; // an empty Enter just leaves the row open

    const parentNode = session.parentId
      ? (optimisticNodes.find((n) => n.id === session.parentId) ?? null)
      : null;
    const tempNode: Node = {
      id: `temp-${crypto.randomUUID()}`,
      code,
      name,
      subGroup: null,
      level: parentNode ? parentNode.level + 1 : 1,
      parentId: session.parentId,
      isLeaf: true,
      weight: 0,
      globalWeight: 0,
    };

    startAddTransition(async () => {
      addOptimisticNode(tempNode);
      try {
        const result = await createKpi({
          fiscalYearId: selectedFiscalYearId,
          parentId: session.parentId,
          code,
          name,
        });
        if (!result.ok) {
          setError(`Couldn't add "${name}": ${result.error}`);
          return;
        }
        setError(null);
        router.refresh();
      } catch {
        setError(`Couldn't add "${name}": could not reach the server.`);
      }
    });

    // Advance and refocus immediately — this doesn't wait on the network, so
    // the next name can be typed the instant this one is submitted.
    session.nextNumber += 1;
    setNewName("");
    setNewCode(session.parentCode ? `${session.parentCode}.${session.nextNumber}` : String(session.nextNumber));
    nameInputRef.current?.focus();
  };

  const renderAddForm = () => (
    <form
      className="ml-4 flex flex-wrap items-center gap-2 border-b py-2"
      onSubmit={(e) => {
        e.preventDefault();
        submitAdd();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") closeAdd();
      }}
    >
      <input
        className="w-28 rounded border border-gray-300 px-2 py-1 text-sm font-mono"
        aria-label="Code"
        placeholder="Code"
        value={newCode}
        onChange={(e) => setNewCode(e.target.value)}
      />
      <input
        ref={nameInputRef}
        className="min-w-48 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
        aria-label="Name"
        placeholder="Name"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        autoFocus
      />
      <button
        type="submit"
        className="rounded bg-blue-600 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >Add</button>
      <button type="button" className="text-xs text-gray-500 hover:underline" onClick={closeAdd}>
        Cancel
      </button>
      <span className="w-full text-xs text-gray-400">
        {addPending
          ? "Saving the last one in the background…"
          : "Enter saves and starts the next one at this level · Esc to stop"}
      </span>
    </form>
  );

  const renderRow = (node: Node): React.ReactNode => {
    const children = childrenOf.get(node.id) ?? [];
    const siblings = childrenOf.get(node.parentId) ?? [];
    const clusterSiblings = siblings.filter((s) => (s.subGroup ?? "") === (node.subGroup ?? ""));
    const index = clusterSiblings.findIndex((s) => s.id === node.id);
    const excludedForMove = new Set([node.id, ...descendantsOf(node.id)]);
    const isTemp = node.id.startsWith("temp-");

    return (
      <li key={node.id}>
        <div
          className={`flex flex-wrap items-center gap-2 border-b py-1.5 text-sm last:border-0 ${isTemp ? "opacity-60" : ""}`}
          style={{ paddingLeft: `${(node.level - 1) * 1.25}rem` }}
        >
          <span className="font-mono text-xs text-gray-400">{node.code}</span>
          {isTemp ? (
            <span>{node.name}</span>
          ) : (
            <Link href={`/kpi/${node.id}`} className="hover:text-blue-700 hover:underline">
              {node.name}
            </Link>
          )}
          <span className="tabular ml-auto text-xs text-gray-500">
            {node.weight.toFixed(1)}% of group · {node.globalWeight.toFixed(1)}% global
          </span>
          {!fiscalYearClosed && !isTemp && (
            <div className="flex items-center gap-1">
              <button type="button" className="rounded border px-1.5 py-0.5 text-xs hover:bg-gray-50" disabled={pending}
                onClick={() => run(() => reorderKpi({ kpiId: node.id, direction: "up" }))}
                aria-label={`Move ${node.name} up`} title="Move up" hidden={index <= 0}
              >↑</button>
              <button type="button" className="rounded border px-1.5 py-0.5 text-xs hover:bg-gray-50" disabled={pending}
                onClick={() => run(() => reorderKpi({ kpiId: node.id, direction: "down" }))}
                aria-label={`Move ${node.name} down`} title="Move down" hidden={index >= clusterSiblings.length - 1}
              >↓</button>
              <button type="button" className="rounded border px-2 py-0.5 text-xs hover:bg-gray-50"
                aria-label={`Edit ${node.name}`}
                onClick={() => setEditingId(node.id)}
              >Edit</button>
              <button type="button" className="rounded border px-2 py-0.5 text-xs hover:bg-gray-50"
                aria-label={`Add a sub-KPI under ${node.name}`}
                onClick={() => openAdd(node.id, node.id)}
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
              {optimisticNodes
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

        {addingUnder === node.id && renderAddForm()}

        {children.length > 0 && (
          <>
            <div style={{ paddingLeft: `${node.level * 1.25}rem` }}>
              {renderBalanceLink(node.id, node.name)}
            </div>
            {renderClusteredChildren(children, node.level)}
          </>
        )}
      </li>
    );
  };

  /** Renders a parent's children clustered by sub-group, with a small header over each named cluster. */
  const renderClusteredChildren = (children: Node[], parentLevel: number) => (
    <>
      {clusterChildren(children).map((cluster) => (
        <div key={cluster.subGroup ?? "__none__"}>
          {cluster.subGroup && (
            <div
              className="pt-1 text-xs font-medium text-gray-400"
              style={{ paddingLeft: `${parentLevel * 1.25}rem` }}
            >
              {cluster.subGroup}
            </div>
          )}
          <ul>{cluster.items.map(renderRow)}</ul>
        </div>
      ))}
    </>
  );

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
            onClick={() => openAdd(null, "ROOT")}
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
        <div className="mb-2">{renderBalanceLink(null, "Strategic Goals")}</div>

        {addingUnder === "ROOT" && renderAddForm()}

        {roots.length === 0 ? (
          <p className="text-sm text-gray-500">No KPIs yet — add a Strategic Goal to get started.</p>
        ) : (
          renderClusteredChildren(roots, 0)
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

      {editingId && (() => {
        const target = optimisticNodes.find((n) => n.id === editingId);
        if (!target) return null;
        return (
          <KpiEditPanel
            key={target.id}
            kpiId={target.id}
            code={target.code}
            name={target.name}
            isLeaf={target.isLeaf}
            weight={target.weight}
            globalWeight={target.globalWeight}
            departments={departments}
            statusOptions={statusOptions}
            onClose={() => setEditingId(null)}
            onSaved={() => {
              setEditingId(null);
              router.refresh();
            }}
          />
        );
      })()}
    </div>
  );
}
