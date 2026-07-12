/* eslint-disable no-console */
import "dotenv/config";

import {
  runStartupSchemaRepairs,
  runFASPAIv3Migrations,
  applyPhaseB_HoldingsUniqueIndex,
  ensureSharedRouteTables,
} from "./schema-repairs";

async function main() {
  console.log("Starting FintekPro schema repair job...");
  await runStartupSchemaRepairs();
  console.log("Phase A complete — running FASP-AI v3.0 migrations...");
  await runFASPAIv3Migrations();
  console.log("Phase B — applying holdings unique index...");
  await applyPhaseB_HoldingsUniqueIndex();
  console.log("Phase C — ensuring shared route tables + FASP-5 seed...");
  await ensureSharedRouteTables();
  console.log("FintekPro schema repair job complete.");
}

main().catch((error) => {
  console.error("FintekPro schema repair job failed:", error);
  process.exitCode = 1;
});
