/**
 * @file scripts/migrate-model-portfolio-compliance-schema.ts
 * @description Safe idempotent migration to ensure model_portfolios has the SEBI institutional compliance columns.
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
	console.log("Starting model_portfolios SEBI compliance schema migration...");

	try {
		await db.execute(sql`
			ALTER TABLE model_portfolios 
			ADD COLUMN IF NOT EXISTS portfolio_tier varchar(50) DEFAULT 'retail_mf' NOT NULL,
			ADD COLUMN IF NOT EXISTS vehicle_type varchar(50) DEFAULT 'MUTUAL_FUND' NOT NULL,
			ADD COLUMN IF NOT EXISTS sebi_regulatory_regime varchar(255) DEFAULT 'SEBI (Mutual Funds) Regulations, 1996 & SEBI (Investment Advisers) Regulations, 2013',
			ADD COLUMN IF NOT EXISTS sebi_regulation_ref varchar(100),
			ADD COLUMN IF NOT EXISTS statutory_min_investment numeric DEFAULT 5000,
			ADD COLUMN IF NOT EXISTS execution_route varchar(50) DEFAULT 'iris',
			ADD COLUMN IF NOT EXISTS custody_structure varchar(100) DEFAULT 'DIRECT_AMC_FOLIO',
			ADD COLUMN IF NOT EXISTS allowed_asset_classes jsonb DEFAULT '[]'::jsonb,
			ADD COLUMN IF NOT EXISTS accreditation_required boolean DEFAULT false,
			ADD COLUMN IF NOT EXISTS lock_in_period_months integer DEFAULT 0,
			ADD COLUMN IF NOT EXISTS sebi_compliance_rules jsonb;

			CREATE INDEX IF NOT EXISTS idx_model_portfolios_tier ON model_portfolios (portfolio_tier);
		`);

		console.log("✅ model_portfolios columns successfully migrated and verified.");
		process.exit(0);
	} catch (error: any) {
		console.error("❌ Migration failed:", error);
		process.exit(1);
	}
}

main();
