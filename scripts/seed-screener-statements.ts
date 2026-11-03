/* eslint-disable no-console */
/**
 * @file seed-screener-statements.ts
 * @description Ingests 10-year P&L, Balance Sheet, Cash Flow, Ratios, Quarterly statements,
 *              and Algorithmic Pros & Cons into screener_financials & screener_master_snapshots.
 */

import * as dotenv from "dotenv";
dotenv.config();

import { pool, db } from "../server/db";
import { sql } from "drizzle-orm";
import { fetchFromScreener } from "../server/modules/research/dataService";
import { generateProsAndCons } from "../server/services/screener/pros-cons-generator";
import { screenerMasterSnapshotService } from "../server/services/screener/screener-master-snapshot-service";

async function main() {
  const args = process.argv.slice(2);
  const targetCount = args[0] ? parseInt(args[0], 10) : 25;

  console.log("================================================================================");
  console.log(`   SCREENER.IN UPGRADE SEEDER: Ingesting 10-Year Statements & Pros/Cons`);
  console.log(`   Target: Top ${targetCount} active stocks by market cap`);
  console.log("================================================================================\n");

  const stocksRes = await db.execute(sql`
    SELECT symbol, company_name, market_cap_value 
    FROM listed_stocks 
    WHERE is_active = true AND symbol IS NOT NULL
    ORDER BY COALESCE(market_cap_value, 0) DESC
    LIMIT ${targetCount}
  `);

  const stocks = stocksRes.rows as Array<{ symbol: string; company_name: string; market_cap_value: string }>;
  console.log(`Found ${stocks.length} candidate stocks. Starting enrichment...\n`);

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < stocks.length; i++) {
    const stock = stocks[i];
    const sym = stock.symbol.toUpperCase();
    console.log(`[${i + 1}/${stocks.length}] Syncing Screener data for ${sym} (${stock.company_name})...`);

    try {
      const s = await fetchFromScreener(sym);
      const hasStatements = (s.plHistory?.rows?.length ?? 0) > 0 || (s.quarterlyHistory?.rows?.length ?? 0) > 0;

      const { pros: finalPros, cons: finalCons } = generateProsAndCons({
        roe: s.roe,
        roce: s.roce,
        pe: s.pe,
        pb: s.pb,
        debtToEquity: s.debtToEquity,
        dividendYield: s.dividendYield,
        salesCagr3Y: s.salesCagr3Y,
        salesCagr5Y: s.salesCagr5Y,
        profitCagr3Y: s.profitCagr3Y,
        profitCagr5Y: s.profitCagr5Y,
        operatingCashFlow: s.operatingCashFlow,
        netIncome: s.netIncome,
        existingPros: s.pros,
        existingCons: s.cons,
      });

      const plJson = s.plHistory ? JSON.stringify(s.plHistory) : null;
      const bsJson = s.bsHistory ? JSON.stringify(s.bsHistory) : null;
      const cfJson = s.cfHistory ? JSON.stringify(s.cfHistory) : null;
      const ratJson = s.ratiosHistory ? JSON.stringify(s.ratiosHistory) : null;
      const qtrJson = s.quarterlyHistory ? JSON.stringify(s.quarterlyHistory) : null;
      const prosJson = JSON.stringify(finalPros);
      const consJson = JSON.stringify(finalCons);

      const curYear = new Date().getFullYear();

      // Atomic upsert into screener_financials
      await db.execute(sql`
        INSERT INTO screener_financials (
          symbol, period, fiscal_year,
          roe, roce, dividend_yield, book_value,
          revenue_growth, earnings_growth, debt_to_equity,
          revenue, net_income, operating_margin, operating_cash_flow, free_cash_flow,
          pl_history, bs_history, cf_history, ratios_history, quarterly_history,
          pros, cons, company_description,
          last_updated
        ) VALUES (
          ${sym}, 'annual', ${curYear},
          ${s.roe}, ${s.roce}, ${s.dividendYield}, ${s.bookValue},
          ${s.revenueGrowth}, ${s.earningsGrowth}, ${s.debtToEquity},
          ${s.revenue}, ${s.netIncome}, ${s.operatingMargin}, ${s.operatingCashFlow}, ${s.freeCashFlow},
          ${plJson}::jsonb, ${bsJson}::jsonb, ${cfJson}::jsonb, ${ratJson}::jsonb, ${qtrJson}::jsonb,
          ${prosJson}::jsonb, ${consJson}::jsonb, ${s.companyDescription ?? null},
          NOW()
        )
        ON CONFLICT (symbol, period) DO UPDATE SET
          roe              = EXCLUDED.roe,
          roce             = EXCLUDED.roce,
          dividend_yield   = EXCLUDED.dividend_yield,
          book_value       = EXCLUDED.book_value,
          revenue_growth   = EXCLUDED.revenue_growth,
          earnings_growth  = EXCLUDED.earnings_growth,
          debt_to_equity   = EXCLUDED.debt_to_equity,
          revenue          = EXCLUDED.revenue,
          net_income       = EXCLUDED.net_income,
          operating_margin = EXCLUDED.operating_margin,
          operating_cash_flow = EXCLUDED.operating_cash_flow,
          free_cash_flow   = EXCLUDED.free_cash_flow,
          pl_history       = EXCLUDED.pl_history,
          bs_history       = EXCLUDED.bs_history,
          cf_history       = EXCLUDED.cf_history,
          ratios_history   = EXCLUDED.ratios_history,
          quarterly_history = EXCLUDED.quarterly_history,
          pros             = EXCLUDED.pros,
          cons             = EXCLUDED.cons,
          company_description = EXCLUDED.company_description,
          last_updated     = NOW()
      `);

      // Refresh master snapshot for this stock
      await screenerMasterSnapshotService.upsertSnapshot(sym);

      console.log(`   ✅ ${sym}: Stored ${s.plHistory?.rows?.length ?? 0} P&L rows, ${s.quarterlyHistory?.rows?.length ?? 0} Qtr rows, ${finalPros.length} pros, ${finalCons.length} cons`);
      succeeded++;
    } catch (err: any) {
      console.warn(`   ⚠️ ${sym} sync error: ${err.message}`);
      failed++;
    }

    // Polite delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log("\n================================================================================");
  console.log(`   SYNC SUMMARY: ${succeeded} succeeded, ${failed} failed out of ${stocks.length}`);
  console.log("================================================================================\n");

  if (pool && typeof pool.end === "function") {
    await pool.end();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
