import {
  scoreFixedTarget,
  scoreRangeTarget,
  scoreMonthCompletion,
  rollupScores,
} from "./scoring";

function check(label: string, actual: number, expected: number) {
  const ok = Math.abs(actual - expected) < 0.001;
  console.log(`${ok ? "OK  " : "FAIL"} ${label}: got ${actual}, expected ${expected}`);
}

// Fixed target, higher-is-better. Poor=3, Meet=7, Good=8, VeryGood=10, Excellent=12
const fixedCfg = { poorThreshold: 3, meetTarget: 7, goodThreshold: 8, veryGoodThreshold: 10, excellentThreshold: 12 };

check("below poor proportional (achieved 4 of poor=3? use smaller)", scoreFixedTarget(1.5, fixedCfg, "HIGHER_BETTER"), (1.5 / 3) * 2.4);
check("poor target example: poor=7, achieved=4", scoreFixedTarget(4, { ...fixedCfg, poorThreshold: 7 }, "HIGHER_BETTER"), (4 / 7) * 2.4);
check("between poor and meet -> improvement needed flat 2.9", scoreFixedTarget(5, fixedCfg, "HIGHER_BETTER"), 2.9);
check("exactly meet -> 3.4", scoreFixedTarget(7, fixedCfg, "HIGHER_BETTER"), 3.4);
check("between meet and good -> 3.4 (meet band)", scoreFixedTarget(7.5, fixedCfg, "HIGHER_BETTER"), 3.4);
check("achieved=9 (meet=7, good=8, verygood=10) -> falls in Good band [8,10) -> 3.9", scoreFixedTarget(9, fixedCfg, "HIGHER_BETTER"), 3.9);
check("achieved=9.5 (verygood=10, excellent=12) -> falls in VeryGood band [10,12) -> wait 9.5<10 so still Good", scoreFixedTarget(9.5, fixedCfg, "HIGHER_BETTER"), 3.9);
check("achieved=10.5 -> falls in VeryGood band [10,12) -> 4.5", scoreFixedTarget(10.5, fixedCfg, "HIGHER_BETTER"), 4.5);
check("beyond excellent capped at 5", scoreFixedTarget(50, fixedCfg, "HIGHER_BETTER"), 5.0);
check("zero -> 0", scoreFixedTarget(0, fixedCfg, "HIGHER_BETTER"), 0);

// Lower is better fixed: e.g. defect count. Poor=20, Meet=10, Good=8, VeryGood=5, Excellent=2
const lowerCfg = { poorThreshold: 20, meetTarget: 10, goodThreshold: 8, veryGoodThreshold: 5, excellentThreshold: 2 };
check("lower-better: exactly meet(10) -> 3.4", scoreFixedTarget(10, lowerCfg, "LOWER_BETTER"), 3.4);
check("lower-better: better than meet, at good(8) edge just under -> good band 3.9", scoreFixedTarget(7, lowerCfg, "LOWER_BETTER"), 3.9);
check("lower-better: worse than poor(20), e.g. 30 -> 0 (over poor threshold means worse than worst)", scoreFixedTarget(30, lowerCfg, "LOWER_BETTER"), 0);
check("lower-better: between meet(10) and poor(20), e.g. 15 -> improvement needed 2.9", scoreFixedTarget(15, lowerCfg, "LOWER_BETTER"), 2.9);
check("lower-better: at excellent(2) or better, e.g. 1 -> 5.0", scoreFixedTarget(1, lowerCfg, "LOWER_BETTER"), 5.0);

// Range target: Meet range [90,95], example bands ascending
const rangeCfg = {
  poor: [0, 69] as [number, number],
  improvementNeeded: [70, 79] as [number, number],
  meet: [80, 89] as [number, number],
  good: [90, 94] as [number, number],
  veryGood: [95, 97] as [number, number],
  excellent: [98, 100] as [number, number],
};
check("range: meet lower edge(80) -> 3.0", scoreRangeTarget(80, rangeCfg, "HIGHER_BETTER"), 3.0);
check("range: meet upper edge(89) -> 3.4", scoreRangeTarget(89, rangeCfg, "HIGHER_BETTER"), 3.4);
check("range: excellent upper(100) -> 5.0", scoreRangeTarget(100, rangeCfg, "HIGHER_BETTER"), 5.0);
check("range: below all (e.g. -5) -> 0", scoreRangeTarget(-5, rangeCfg, "HIGHER_BETTER"), 0);
check("range: above all (e.g. 150) -> 5.0", scoreRangeTarget(150, rangeCfg, "HIGHER_BETTER"), 5.0);

// Month completion: target Oct 2026
const monthCfg = { targetMonth: "2026-10" };
check("month: Oct 1 2026 -> 3.4", scoreMonthCompletion(new Date(2026, 9, 1), monthCfg), 3.4);
check("month: Oct 31 2026 -> 3.0", scoreMonthCompletion(new Date(2026, 9, 31), monthCfg), 3.0);
check("month: Sep 1 2026 (1 month early, day1) -> 3.9", scoreMonthCompletion(new Date(2026, 8, 1), monthCfg), 3.9);
check("month: Sep 30 2026 (1 month early, last day) -> 3.5", scoreMonthCompletion(new Date(2026, 8, 30), monthCfg), 3.5);
check("month: Jul 2026 (3 months early, day1) -> 5.0", scoreMonthCompletion(new Date(2026, 6, 1), monthCfg), 5.0);
check("month: Nov 30 2026 (1 month late, last day) -> 2.5", scoreMonthCompletion(new Date(2026, 10, 30), monthCfg), 2.5);
check("month: Dec 31 2026 (2 months late, last day) -> 0", scoreMonthCompletion(new Date(2026, 11, 31), monthCfg), 0);
check("month: Jan 2027 (3 months late) -> 0", scoreMonthCompletion(new Date(2027, 0, 5), monthCfg), 0);
check("month: Jun 2026 (4 months early) -> capped 5.0", scoreMonthCompletion(new Date(2026, 5, 1), monthCfg), 5.0);

// Rollup
check("rollup simple average equal weight", rollupScores([{ score: 4, weight: 1 }, { score: 2, weight: 1 }]) ?? -1, 3);
check("rollup weighted", rollupScores([{ score: 5, weight: 3 }, { score: 2, weight: 1 }]) ?? -1, 4.25);
check("rollup ignores nulls", rollupScores([{ score: null, weight: 5 }, { score: 4, weight: 1 }]) ?? -1, 4);

console.log("Done.");
