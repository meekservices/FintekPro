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

  // ── FASP-5 & FASP-6: Direct runner-level portfolio seeds ─────────────────
  // These run AFTER all table migrations, using a fresh pg.Pool connection
  // (no dependency on Drizzle ORM template or module-scope imports).
  // Regular Plan ISINs only — FintekPro is a SEBI-registered distributor.
  console.log("Phase D — seeding FASP-5 (PSU & Defence) and FASP-6 (Future Multibaggers)...");
  const directPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // FASP-5: PSU & Defence Atmanirbhar
    const f5Alloc = JSON.stringify([
      { type: "defence", label: "Defence & Aerospace", weight: 55, color: "#1D4ED8" },
      { type: "psu",     label: "PSU Equity",          weight: 30, color: "#059669" },
      { type: "liquid",  label: "Liquid Buffer",        weight: 15, color: "#6B7280" },
    ]);
    const f5Hold = JSON.stringify([
      { name: "SBI Defence Opportunities Fund",  isin: "INF200KB1290", weight: 20, type: "equity" },
      { name: "HDFC Defence Fund",               isin: "INF179KC1GL9", weight: 18, type: "equity" },
      { name: "Edelweiss India Defence Fund",    isin: "INF754K01LN7", weight: 17, type: "equity" },
      { name: "SBI PSU Fund",                    isin: "INF200K01BC0", weight: 15, type: "equity" },
      { name: "ICICI Pru Manufacturing Fund",    isin: "INF109K01AW3", weight: 10, type: "equity" },
      { name: "Nippon India Power & Infra Fund", isin: "INF204K01UB5", weight: 10, type: "equity" },
      { name: "SBI Liquid Fund",                 isin: "INF200K01MA1", weight:  8, type: "liquid" },
      { name: "ICICI Pru Liquid Fund",           isin: "INF109K01027", weight:  2, type: "liquid" },
    ]);
    const f5 = await directPool.query(
      `INSERT INTO model_portfolios
          (id, name, tagline, risk_profile, asset_class, goal, min_investment,
           time_horizon, benchmark_name, last_rebalanced, rebalancing_frequency,
           total_holdings, highlight, icon, is_featured, allocation, holdings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [
        "psu-defence-atmanirbhar",
        "PSU & Defence Atmanirbhar",
        "India self-reliance mission - government capex + defence indigenisation",
        "aggressive", "thematic",
        JSON.stringify(["capital_appreciation", "thematic", "government_capex"]),
        15000, "5-7 years", "Nifty India Defence Index", "2026-07-10",
        "quarterly", 8,
        "HAL, BEL, GRSE, Cochin Shipyard - India defence capex supercycle",
        "[D]", true, f5Alloc, f5Hold,
      ]
    );
    console.log(`  ✅ FASP-5: psu-defence-atmanirbhar — inserted ${f5.rowCount} row(s)`);

    // FASP-6: Future Multibaggers
    const f6Alloc = JSON.stringify([
      { type: "small_cap", label: "Small Cap",       weight: 60, color: "#7C3AED" },
      { type: "mid_cap",   label: "Mid Cap",         weight: 25, color: "#0891B2" },
      { type: "multi_cap", label: "Multi Cap Alpha", weight: 10, color: "#059669" },
      { type: "liquid",    label: "Liquid Buffer",   weight:  5, color: "#6B7280" },
    ]);
    const f6Hold = JSON.stringify([
      { name: "Nippon India Small Cap Fund", isin: "INF204K01GQ2", weight: 20, type: "equity" },
      { name: "SBI Small Cap Fund",          isin: "INF200K01T28", weight: 18, type: "equity" },
      { name: "Quant Small Cap Fund",        isin: "INF966L01AA0", weight: 12, type: "equity" },
      { name: "HDFC Small Cap Fund",         isin: "INF179KA1RZ8", weight: 10, type: "equity" },
      { name: "Motilal Oswal Midcap Fund",   isin: "INF247L01965", weight: 15, type: "equity" },
      { name: "PGIM India Midcap Opp Fund",  isin: "INF663L01CA3", weight: 10, type: "equity" },
      { name: "Quant Active Fund",           isin: "INF082J01275", weight: 10, type: "equity" },
      { name: "SBI Liquid Fund",             isin: "INF200K01MA1", weight:  5, type: "liquid" },
    ]);
    const f6 = await directPool.query(
      `INSERT INTO model_portfolios
          (id, name, tagline, risk_profile, asset_class, goal, min_investment,
           time_horizon, benchmark_name, last_rebalanced, rebalancing_frequency,
           total_holdings, highlight, icon, is_featured, allocation, holdings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [
        "future-multibaggers",
        "Future Multibaggers",
        "Tomorrow's 10x stocks today - early-mover exposure to India's next wave of compounders",
        "aggressive", "equity",
        JSON.stringify(["capital_appreciation", "wealth_creation", "high_growth"]),
        25000, "7-10 years", "Nifty Smallcap 250", "2026-07-12",
        "quarterly", 8,
        "Nippon Small Cap, Quant Small Cap, Motilal Midcap - riding India next growth decade",
        "[R]", true, f6Alloc, f6Hold,
      ]
    );
    console.log(`  ✅ FASP-6: future-multibaggers — inserted ${f6.rowCount} row(s)`);
  } catch (e: any) {
    console.error("  ❌ FASP-5/6 seed error:", e.message, "| code:", e.code, "| detail:", e.detail);
    throw e;
  } finally {
    await directPool.end();
  }

  console.log("FintekPro schema repair job complete.");
}

main().catch((error) => {
  console.error("FintekPro schema repair job failed:", error);
  process.exitCode = 1;
});
