"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { getScorecard } from "@/lib/data";
import { bandLabel, bandForScore, roundScore } from "@/lib/scoring";
import { assertFiscalYearOpen } from "@/lib/validation";
import { attempt, type ActionResult } from "./result";

function describeScore(score: number | null): string {
  if (score === null) return "no score";
  const band = bandForScore(score);
  return `${score.toFixed(1)} (${bandLabel(band)})`;
}

async function loadLeafForCalibration(kpiId: string) {
  const kpi = await prisma.kpi.findUnique({
    where: { id: kpiId },
    include: {
      _count: { select: { children: true } },
      fiscalYear: { select: { id: true, closedAt: true, label: true } },
    },
  });
  if (!kpi) throw new Error("That KPI no longer exists.");
  if (kpi._count.children > 0) {
    throw new Error("Only a leaf KPI's score can be calibrated — a rollup's score always follows its children.");
  }
  assertFiscalYearOpen(kpi.fiscalYear);
  return kpi;
}

export async function overrideScore(input: {
  kpiId: string;
  period: string;
  score: number;
  reason: string;
}): Promise<ActionResult> {
  return attempt(async () => {
    const admin = await requireAdmin();

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period)) {
      throw new Error(`"${input.period}" is not a valid month.`);
    }
    if (!Number.isFinite(input.score) || input.score < 0 || input.score > 5) {
      throw new Error("A calibrated score must be between 0 and 5.");
    }
    const reason = input.reason.trim();
    if (!reason) throw new Error("Explain why this score is being calibrated.");

    const kpi = await loadLeafForCalibration(input.kpiId);
    const score = roundScore(input.score);

    const scorecard = await getScorecard({ fiscalYearId: kpi.fiscalYear.id, period: input.period });
    const before = scorecard?.byId.get(input.kpiId)?.score ?? null;

    await prisma.$transaction(async (tx) => {
      await tx.scoreOverride.upsert({
        where: { kpiId_period: { kpiId: input.kpiId, period: input.period } },
        create: { kpiId: input.kpiId, period: input.period, score, reason, byId: admin.id },
        update: { score, reason, byId: admin.id },
      });
      await tx.kpiAudit.create({
        data: {
          kpiId: input.kpiId,
          field: "scoreOverride",
          label: `Score calibrated for ${input.period}`,
          from: describeScore(before),
          to: `${describeScore(score)} — ${reason}`,
          author: admin.username,
        },
      });
    });

    revalidatePath("/");
    revalidatePath("/kpis");
    revalidatePath(`/kpi/${input.kpiId}`);
  });
}

export async function clearOverride(kpiId: string, period: string): Promise<ActionResult> {
  return attempt(async () => {
    const admin = await requireAdmin();

    const kpi = await loadLeafForCalibration(kpiId);
    const existing = await prisma.scoreOverride.findUnique({
      where: { kpiId_period: { kpiId, period } },
    });
    if (!existing) throw new Error("There is no calibration to remove for that month.");

    // What the score will be once this override is gone — computed from
    // already-loaded data with this one override filtered out, rather than a
    // second round trip after deleting.
    const scorecard = await getScorecard({ fiscalYearId: kpi.fiscalYear.id, period });
    let after: number | null = null;
    if (scorecard) {
      const { buildScoredTree } = await import("@/lib/kpi-tree");
      const remaining = (scorecard.overrides.get(kpiId) ?? []).filter((o) => o.period !== period);
      const overridesWithoutThis = new Map(scorecard.overrides);
      if (remaining.length > 0) overridesWithoutThis.set(kpiId, remaining);
      else overridesWithoutThis.delete(kpiId);
      after = buildScoredTree(scorecard.kpiRecords, scorecard.values, period, overridesWithoutThis).byId.get(kpiId)?.score ?? null;
    }

    await prisma.$transaction(async (tx) => {
      await tx.scoreOverride.delete({ where: { kpiId_period: { kpiId, period } } });
      await tx.kpiAudit.create({
        data: {
          kpiId,
          field: "scoreOverride",
          label: `Score calibration removed for ${period}`,
          from: describeScore(existing.score),
          to: describeScore(after),
          author: admin.username,
        },
      });
    });

    revalidatePath("/");
    revalidatePath("/kpis");
    revalidatePath(`/kpi/${kpiId}`);
  });
}
