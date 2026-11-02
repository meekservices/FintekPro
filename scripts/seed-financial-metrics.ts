/* eslint-disable no-console */
/**
 * Programmatic Seeding Script: Company Financial Metrics
 * 
 * Invokes FinancialMetricsRefreshService to fetch licensed financial ratios
 * (P/E, P/B, ROE, ROCE, D/E, Operating Margins, Net Margins, CAGRs)
 * from IndianAPI -> Screener.in -> Yahoo Finance waterfall and upsert
 * into the stock_financial_metrics table.
 *
 * Usage:
 *   npx ts-node scripts/seed-financial-metrics.ts [batchSize=100]
 */

import * as dotenv from "dotenv";
dotenv.config();

import { financialMetricsRefreshService } from "../server/services/financial-metrics-refresh-service";
import { pool } from "../server/db";

async function main() {
  const batchSize = parseInt(process.argv[2] || "100", 10);
  console.log(`🚀 Starting programmatic financial metrics seeding (Target: ${batchSize} stocks)...`);

  const startTime = Date.now();
  try {
    const result = await financialMetricsRefreshService.refreshAllStockMetrics(batchSize);
    console.log(`✅ Financial metrics seeding complete!`);
    console.log(`📊 Results: ${result.success} succeeded, ${result.failed} failed. Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  } catch (err: any) {
    console.error(`❌ Seeding failed:`, err?.message || err);
  } finally {
    if (pool && typeof pool.end === "function") {
      await pool.end();
    }
    process.exit(0);
  }
}

main();
