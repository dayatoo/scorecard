"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type {
  Direction,
  TargetMode,
  LeafMetricType,
  FixedTargetConfig,
  RangeTargetConfig,
  MonthTargetConfig,
} from "@/lib/scoring";

export type KpiInput = {
  name: string;
  parentId: string | null;
  weight: number;
  sortOrder?: number;
  metricType: LeafMetricType | null;
  direction: Direction | null;
  targetMode: TargetMode | null;
  targetConfig: FixedTargetConfig | RangeTargetConfig | MonthTargetConfig | null;
};

export async function createKpi(input: KpiInput) {
  await prisma.kpi.create({
    data: {
      name: input.name,
      parentId: input.parentId,
      weight: input.weight,
      sortOrder: input.sortOrder ?? 0,
      metricType: input.metricType,
      direction: input.direction,
      targetMode: input.targetMode,
      targetConfig: input.targetConfig ? JSON.stringify(input.targetConfig) : null,
    },
  });
  revalidatePath("/");
  revalidatePath("/manage");
  revalidatePath("/entry");
}

export async function updateKpi(id: string, input: KpiInput) {
  await prisma.kpi.update({
    where: { id },
    data: {
      name: input.name,
      parentId: input.parentId,
      weight: input.weight,
      sortOrder: input.sortOrder ?? 0,
      metricType: input.metricType,
      direction: input.direction,
      targetMode: input.targetMode,
      targetConfig: input.targetConfig ? JSON.stringify(input.targetConfig) : null,
    },
  });
  revalidatePath("/");
  revalidatePath("/manage");
  revalidatePath("/entry");
}

export async function deleteKpi(id: string) {
  await prisma.kpi.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/manage");
  revalidatePath("/entry");
}

export type KpiValueInput = {
  kpiId: string;
  period: string; // "YYYY-MM"
  value: number | null;
  completionDate: string | null; // "YYYY-MM-DD"
  note: string | null;
};

export async function upsertKpiValue(input: KpiValueInput) {
  await prisma.kpiValue.upsert({
    where: { kpiId_period: { kpiId: input.kpiId, period: input.period } },
    create: {
      kpiId: input.kpiId,
      period: input.period,
      value: input.value,
      completionDate: input.completionDate ? new Date(input.completionDate) : null,
      note: input.note,
    },
    update: {
      value: input.value,
      completionDate: input.completionDate ? new Date(input.completionDate) : null,
      note: input.note,
    },
  });
  revalidatePath("/");
  revalidatePath("/entry");
}

export async function deleteKpiValue(id: string) {
  await prisma.kpiValue.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/entry");
}
