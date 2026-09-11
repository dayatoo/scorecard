import { execFileSync } from "node:child_process";

/**
 * Reseeds the sample scorecard before the suite runs.
 *
 * These tests share one database, so a run that fails partway can leave a
 * figure behind and break unrelated tests next time. Starting from a known
 * baseline makes the suite deterministic however the previous run ended.
 */
export default function globalSetup() {
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit" });
}
