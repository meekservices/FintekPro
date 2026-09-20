#!/usr/bin/env tsx
/**
 * @file scripts/init-bigquery-warehouse.ts
 * @description One-time / CI script to initialize BigQuery Time-Series Warehouse.
 *
 * Provisions:
 *   - Dataset: fintekpro_analytics (asia-south1)
 *   - Tables:
 *     - daily_nav_timeseries (partitioned by nav_date, clustered by scheme_code, category)
 *     - stock_eod_timeseries (partitioned by trade_date, clustered by symbol)
 *     - factor_metrics_history (partitioned by calculation_date, clustered by instrument_id)
 *
 * Usage:
 *   npx tsx scripts/init-bigquery-warehouse.ts
 */

import { bigQueryTimeSeriesService } from "../server/services/bigquery-timeseries-service";
import { logger } from "../server/logger";

async function main() {
	logger.info("[InitBigQuery] Initializing BigQuery dataset and partitioned tables...");
	try {
		await bigQueryTimeSeriesService.ensureDatasetAndTables();
		logger.info("[InitBigQuery] ✅ BigQuery Time-Series Warehouse initialized successfully!");
		process.exit(0);
	} catch (error: any) {
		logger.error("[InitBigQuery] ❌ Failed to initialize BigQuery warehouse", {
			error: error?.message,
			stack: error?.stack,
		});
		process.exit(1);
	}
}

main();
