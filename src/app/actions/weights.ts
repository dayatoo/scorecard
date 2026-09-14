"use server";

import { revalidatePath } from "next/cache";

import { loadKpiRecords } from "@/lib/data";
import type { KpiRecord } from "@/lib/kpi-tree";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { assertFiscalYearOpen } from "@/lib/validation";
import { attempt, type ActionResult } from "./result";

// Bulk weight editing, one sibling group at a time — kept apart from
// hierarchy.ts (structure) and kpi.ts (per-KPI settings) since setting every
// child's weight together, with a live balance check, is its own kind of
// edit that neither of those forms is built for.

function childrenMap(kpis: KpiRecord[]) {
  const map = new Map<string | null, KpiRecord[]>();
  for (const kpi of kpis) {
    const list = map.get(kpi.parentId) ?? [];
    list.push(kpi);
    map.set(kpi.parentId, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  }
  return map;
}

export type WeightGroup = {
  parentId: string | null;
  parentLabel: string;
  breadcrumb: string;
  total: number;
  childCount: number;
};

export async function listWeightGroups(fiscalYearId: string): Promise<ActionResult<WeightGroup[]>> {
  return attempt(async () => {
    await requireAdmin();

    const kpis = await loadKpiRecords(fiscalYearId);
    const byId = new Map(kpis.map((k) => [k.id, k]));
    const children = childrenMap(kpis);

    const breadcrumbOf = (kpi: KpiRecord): string => {
      const chain: string[] = [];
      let current = kpi.parentId ? byId.get(kpi.parentId) : undefined;
      while (current) {
        chain.unshift(current.name);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
      return chain.join(" > ");
    };

    const roots = children.get(null) ?? [];
    const groups: WeightGroup[] = [
      {
        parentId: null,
        parentLabel: "Strategic Goals",
        breadcrumb: "",
        total: roots.reduce((sum, k) => sum + k.weight, 0),
        childCount: roots.length,
      },
    ];

    for (const kpi of kpis) {
      const kids = children.get(kpi.id) ?? [];
      if (kids.length === 0) continue;
      groups.push({
        parentId: kpi.id,
        parentLabel: kpi.name,
        breadcrumb: breadcrumbOf(kpi),
        total: kids.reduce((sum, k) => sum + k.weight, 0),
        childCount: kids.length,
      });
    }

    return groups;
  });
}

export type WeightChild = {
  id: string;
  code: string;
  name: string;
  weight: number;
  subGroup: string | null;
};

export async function getGroupWeights(
  fiscalYearId: string,
  parentId: string | null
): Promise<ActionResult<{ parentLabel: string; children: WeightChild[] }>> {
  return attempt(async () => {
    await requireAdmin();

    const kpis = await loadKpiRecords(fiscalYearId);
    let parentLabel = "Strategic Goals";
    if (parentId) {
      const parent = kpis.find((k) => k.id === parentId);
      if (!parent) throw new Error("That KPI no longer exists.");
      parentLabel = parent.name;
    }

    const kids = (childrenMap(kpis).get(parentId) ?? []).map((k) => ({
      id: k.id,
      code: k.code,
      name: k.name,
      weight: k.weight,
      subGroup: k.subGroup ?? null,
    }));

    return { parentLabel, children: kids };
  });
}

export async function setGroupWeights(input: {
  fiscalYearId: string;
  parentId: string | null;
  weights: { id: string; weight: number }[];
}): Promise<ActionResult> {
  return attempt(async () => {
    const user = await requireAdmin();

    const fiscalYear = await prisma.fiscalYear.findUnique({
      where: { id: input.fiscalYearId },
      select: { closedAt: true, label: true },
    });
    if (!fiscalYear) throw new Error("That fiscal year no longer exists.");
    assertFiscalYearOpen(fiscalYear);

    const children = await prisma.kpi.findMany({
      where: { fiscalYearId: input.fiscalYearId, parentId: input.parentId },
      select: { id: true, weight: true },
    });
    if (children.length === 0) throw new Error("This group has no KPIs to weight.");

    const byId = new Map(children.map((c) => [c.id, c]));
    for (const { id } of input.weights) {
      if (!byId.has(id)) throw new Error("One of these KPIs no longer belongs to this group.");
    }
    if (input.weights.length !== children.length) {
      throw new Error("Every KPI in this group needs a weight.");
    }

    // A group of one has nothing to divide — it is always the whole of its
    // parent's share, whatever the form happened to send.
    const finalWeights =
      children.length === 1 ? [{ id: children[0].id, weight: 100 }] : input.weights;

    await prisma.$transaction(async (tx) => {
      for (const { id, weight } of finalWeights) {
        const before = byId.get(id);
        if (!before || before.weight === weight) continue;
        await tx.kpi.update({ where: { id }, data: { weight } });
        await tx.kpiAudit.create({
          data: {
            kpiId: id,
            field: "weight",
            label: "Weight",
            from: `${before.weight.toFixed(2)}%`,
            to: `${weight.toFixed(2)}%`,
            author: user.username,
          },
        });
      }
    });

    revalidatePath("/manage/hierarchy");
    revalidatePath("/manage/hierarchy/weights");
    revalidatePath(`/manage/hierarchy/weights/${input.parentId ?? "root"}`);
    revalidatePath("/");
    revalidatePath("/kpis");
  });
}
