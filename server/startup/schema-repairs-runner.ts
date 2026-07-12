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

  // ── Phase E: Convert MF scheme holdings → direct NSE equity stocks ──────────
  // Only updates portfolios still holding INF-prefix MF ISINs.
  // AI-rebalanced portfolios (already INE-based) are conditionally skipped.
  // Excluded: ELSS, Arbitrage, Passive Index, International (per user directive).
  console.log("Phase E — converting MF scheme holdings to direct equity stocks...");
  try {
    const { db: stockSeedDb } = await import("../db");
    const { seedStockPortfolios } = await import("./portfolio-stock-seeds");
    await seedStockPortfolios(stockSeedDb);
  } catch (e: any) {
    console.error("  ❌ Phase E error:", e.message);
    // Non-fatal: schema repair job continues even if stock seed fails
  }

  // ── Phase F: Populate portfolioCode (FP-NNN) + inceptionDate + rebalancingMode ─
  // portfolioCode — stable FP-NNN code printed on cards, reports and audit logs.
  // inceptionDate — required for inception-based rolling bar chart.
  // rebalancingMode — default all to drift_triggered per product decision.
  // Also ensures model_portfolio_nav_history table exists (idempotent CREATE).
  console.log("Phase F — populating portfolioCode, inceptionDate, rebalancingMode + nav history table...");
  try {
    const { db: phFDb } = await import("../db");
    const { sql: phFSql } = await import("drizzle-orm");

    // 1. Ensure model_portfolio_nav_history table exists
    await phFDb.execute(phFSql`
      CREATE TABLE IF NOT EXISTS model_portfolio_nav_history (
        id               SERIAL PRIMARY KEY,
        portfolio_id     VARCHAR NOT NULL REFERENCES model_portfolios(id) ON DELETE CASCADE,
        month_start      DATE NOT NULL,
        nav              NUMERIC(15,4),
        monthly_return   NUMERIC(8,4),
        absolute_return  NUMERIC(8,4),
        benchmark_return NUMERIC(8,4),
        benchmark_cum_return NUMERIC(8,4),
        had_rebalance_event BOOLEAN DEFAULT FALSE,
        rebalance_trigger   TEXT,
        source           VARCHAR DEFAULT 'cron',
        engine_version   VARCHAR DEFAULT 'FASP-AI-v3.0',
        created_at       TIMESTAMP DEFAULT NOW(),
        updated_at       TIMESTAMP DEFAULT NOW(),
        CONSTRAINT uq_mpnh_portfolio_month UNIQUE (portfolio_id, month_start)
      )
    `);
    await phFDb.execute(phFSql`CREATE INDEX IF NOT EXISTS idx_mpnh_portfolio_id ON model_portfolio_nav_history(portfolio_id)`);
    await phFDb.execute(phFSql`CREATE INDEX IF NOT EXISTS idx_mpnh_month_start ON model_portfolio_nav_history(month_start)`);
    console.log("  ✅ Phase F.1: model_portfolio_nav_history table ensured");

    // 2. Ensure rebalancing_mode column exists (Drizzle migration may lag)
    await phFDb.execute(phFSql`
      ALTER TABLE model_portfolios ADD COLUMN IF NOT EXISTS rebalancing_mode VARCHAR DEFAULT 'drift_triggered'
    `).catch(() => {/* column may already exist */});

    // 3. Assign FP-NNN codes to all portfolios that don't have one yet.
    //    Uses a deterministic ordering by created_at so codes never change on re-runs.
    const uncodedRes = await phFDb.execute(phFSql`
      SELECT id FROM model_portfolios
      WHERE portfolio_code IS NULL
      ORDER BY created_at ASC
    `);
    const uncoded = (uncodedRes as any).rows ?? [];

    // Find current max FP code to continue numbering
    const maxCodeRes = await phFDb.execute(phFSql`
      SELECT MAX(CAST(SUBSTRING(portfolio_code FROM 4) AS INTEGER)) AS max_num
      FROM model_portfolios
      WHERE portfolio_code IS NOT NULL AND portfolio_code LIKE 'FP-%'
    `);
    const startNum = ((maxCodeRes as any).rows?.[0]?.max_num ?? 0) + 1;

    for (let i = 0; i < uncoded.length; i++) {
      const code = `FP-${String(startNum + i).padStart(3, "0")}`;
      await phFDb.execute(phFSql`
        UPDATE model_portfolios SET portfolio_code = ${code} WHERE id = ${uncoded[i].id}
      `);
    }
    console.log(`  ✅ Phase F.2: portfolioCode populated for ${uncoded.length} portfolios (starting FP-${String(startNum).padStart(3, "0")})`);

    // 4. Set inceptionDate from created_at for portfolios that are missing it.
    const inceptionRes = await phFDb.execute(phFSql`
      UPDATE model_portfolios
      SET inception_date = CAST(created_at AS DATE)
      WHERE inception_date IS NULL
      RETURNING id
    `);
    const inceptionCount = ((inceptionRes as any).rowCount ?? (inceptionRes as any).rows?.length ?? 0);
    console.log(`  ✅ Phase F.3: inceptionDate populated for ${inceptionCount} portfolios`);

    // 5. Set rebalancingMode = drift_triggered for all portfolios (product decision)
    await phFDb.execute(phFSql`
      UPDATE model_portfolios SET rebalancing_mode = 'drift_triggered'
      WHERE rebalancing_mode IS NULL OR rebalancing_mode = 'quarterly'
    `);
    console.log("  ✅ Phase F.4: rebalancingMode = drift_triggered applied to all portfolios");

  } catch (e: any) {
    console.error("  ❌ Phase F error:", e.message, "|", e.code);
    // Non-fatal
  }

  console.log("FintekPro schema repair job complete.");
}

main().catch((error) => {
  console.error("FintekPro schema repair job failed:", error);
  process.exitCode = 1;
});
