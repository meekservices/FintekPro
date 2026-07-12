/* eslint-disable no-console */
import "dotenv/config";
import pg from "pg";

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
  console.log("Phase C — ensuring shared route tables...");
  await ensureSharedRouteTables();

  // ── Phase D: FASP-5 & FASP-6 portfolio seeds ──────────────────────────────
  // Uses Drizzle ORM db.insert().onConflictDoNothing() — same pattern as the
  // working /admin/seed-missing-portfolios route. Correct camelCase→snake_case
  // column mapping, proper type handling, isPublished: true, Regular Plan ISINs.
  console.log("Phase D — seeding FASP-5 (PSU & Defence) and FASP-6 (Future Multibaggers)...");
  try {
    const { db: seedDb } = await import("../db");
    const { modelPortfolios: mp } = await import("../../shared/schema");

    // FASP-5: PSU & Defence Atmanirbhar
    await seedDb.insert(mp).values({
      id:                  "psu-defence-atmanirbhar",
      name:                "PSU & Defence Atmanirbhar",
      tagline:             "India self-reliance mission — government capex + defence indigenisation",
      riskProfile:         "aggressive",
      assetClass:          "thematic",
      goals:               ["capital_appreciation", "thematic", "government_capex"],
      minInvestment:       "15000",
      timeHorizon:         "5-7 years",
      benchmarkName:       "Nifty India Defence Index",
      lastRebalanced:      "2026-07-10",
      rebalancingFrequency:"quarterly",
      totalHoldings:       8,
      highlight:           "HAL, BEL, GRSE, Cochin Shipyard — India defence capex supercycle",
      icon:                "[D]",
      isPublished:         true,
      isFeatured:          true,
      isNew:               true,
      allocation: [
        { type: "defence", label: "Defence & Aerospace", weight: 55, color: "#1D4ED8" },
        { type: "psu",     label: "PSU Equity",          weight: 30, color: "#059669" },
        { type: "liquid",  label: "Liquid Buffer",        weight: 15, color: "#6B7280" },
      ],
      holdings: [
        { name: "SBI Defence Opportunities Fund",  isin: "INF200KB1290", weight: 20, type: "equity" },
        { name: "HDFC Defence Fund",               isin: "INF179KC1GL9", weight: 18, type: "equity" },
        { name: "Edelweiss India Defence Fund",    isin: "INF754K01LN7", weight: 17, type: "equity" },
        { name: "SBI PSU Fund",                    isin: "INF200K01BC0", weight: 15, type: "equity" },
        { name: "ICICI Pru Manufacturing Fund",    isin: "INF109K01AW3", weight: 10, type: "equity" },
        { name: "Nippon India Power & Infra Fund", isin: "INF204K01UB5", weight: 10, type: "equity" },
        { name: "SBI Liquid Fund",                 isin: "INF200K01MA1", weight:  8, type: "liquid" },
        { name: "ICICI Pru Liquid Fund",           isin: "INF109K01027", weight:  2, type: "liquid" },
      ],
      source:        "api",
      engineVersion: "1.0.0",
    }).onConflictDoNothing();
    console.log("  ✅ FASP-5: psu-defence-atmanirbhar — seeded (ON CONFLICT DO NOTHING)");

    // FASP-6: Future Multibaggers
    await seedDb.insert(mp).values({
      id:                  "future-multibaggers",
      name:                "Future Multibaggers",
      tagline:             "Tomorrow's 10x stocks today — early-mover exposure to India's next wave of compounders",
      riskProfile:         "aggressive",
      assetClass:          "equity",
      goals:               ["capital_appreciation", "wealth_creation", "high_growth"],
      minInvestment:       "25000",
      timeHorizon:         "7-10 years",
      benchmarkName:       "Nifty Smallcap 250",
      lastRebalanced:      "2026-07-12",
      rebalancingFrequency:"quarterly",
      totalHoldings:       8,
      highlight:           "Nippon Small Cap, Quant Small Cap, Motilal Midcap — India's next growth decade",
      icon:                "[R]",
      isPublished:         true,
      isFeatured:          true,
      isNew:               true,
      allocation: [
        { type: "small_cap", label: "Small Cap",       weight: 60, color: "#7C3AED" },
        { type: "mid_cap",   label: "Mid Cap",         weight: 25, color: "#0891B2" },
        { type: "multi_cap", label: "Multi Cap Alpha", weight: 10, color: "#059669" },
        { type: "liquid",    label: "Liquid Buffer",   weight:  5, color: "#6B7280" },
      ],
      holdings: [
        { name: "Nippon India Small Cap Fund", isin: "INF204K01GQ2", weight: 20, type: "equity" },
        { name: "SBI Small Cap Fund",          isin: "INF200K01T28", weight: 18, type: "equity" },
        { name: "Quant Small Cap Fund",        isin: "INF966L01AA0", weight: 12, type: "equity" },
        { name: "HDFC Small Cap Fund",         isin: "INF179KA1RZ8", weight: 10, type: "equity" },
        { name: "Motilal Oswal Midcap Fund",   isin: "INF247L01965", weight: 15, type: "equity" },
        { name: "PGIM India Midcap Opp Fund",  isin: "INF663L01CA3", weight: 10, type: "equity" },
        { name: "Quant Active Fund",           isin: "INF082J01275", weight: 10, type: "equity" },
        { name: "SBI Liquid Fund",             isin: "INF200K01MA1", weight:  5, type: "liquid" },
      ],
      source:        "api",
      engineVersion: "1.0.0",
    }).onConflictDoNothing();
    console.log("  ✅ FASP-6: future-multibaggers — seeded (ON CONFLICT DO NOTHING)");
  } catch (e: any) {
    console.error("  ❌ Phase D seed error:", e.message, "| code:", e.code, "| detail:", e.detail);
    throw e;
  }

  console.log("FintekPro schema repair job complete.");
}

main().catch((error) => {
  console.error("FintekPro schema repair job failed:", error);
  process.exitCode = 1;
});
