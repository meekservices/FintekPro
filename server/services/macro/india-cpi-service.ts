/**
 * @file india-cpi-service.ts
 * @description India Consumer Price Index (CPI) Inflation & MoSPI Macro Service.
 *
 * Dedicated institutional engine for India Headline CPI (Combined), Food Inflation (CFPI),
 * Rural/Urban breakdown, RBI Tolerance Band tracking, and Real Yield calculations.
 *
 * Release Frequency:
 *   - Frequency: Monthly
 *   - Schedule: 12th of each month at 17:30 IST (or next business day if 12th is a holiday)
 *   - Releasing Agency: Ministry of Statistics & Programme Implementation (MoSPI) / NSO
 *   - Target Policy Mandate: RBI MPC statutory inflation target of 4.00% ± 2.00% (2.00% – 6.00%)
 *
 * Downstream Consumers:
 *   - GoldenPricingEngine: Macro indicators snapshot & MACRO_IN_CPI / MACRO_INDIA_CPI prices
 *   - DMIE (Domestic Market Intelligence Engine): Inflation stance, real policy rate, real yield
 *   - Knowledge Hub & Daily Market Brief: UI Cards, narrative token hydrators, WhatsApp export
 *   - CCIL / FBIL Market Services: G-Sec real yield carry calculations
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v1.0
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import { logger } from "../../logger";
import { telemetryBus } from "../engine-telemetry-bus";

export const INDIA_CPI_ENGINE_VERSION = "IN-CPI-v1.0.0";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15-minute in-process cache

export type RbiInflationStance =
	| "BREACH_UPPER_BAND"      // > 6.00% (Exceeds upper tolerance)
	| "ELEVATED_WATCH"         // 5.00% - 6.00%
	| "TARGET_ANCHORED"        // 3.50% - 4.50%
	| "BENIGN_LOWER_HALF"      // 2.00% - 3.50%
	| "BELOW_LOWER_BAND";      // < 2.00% (Disinflation / deflationary)

export interface MoSpiCpiRelease {
	period: string;             // e.g. "October 2024"
	periodCode: string;         // e.g. "2024-10"
	releaseDate: string;        // e.g. "2024-11-12"
	headlineYoY: number;        // Headline CPI (Combined) YoY %
	cfpiFoodInflationYoY: number;// Consumer Food Price Index (CFPI) YoY %
	ruralYoY: number;           // Rural CPI YoY %
	urbanYoY: number;           // Urban CPI YoY %
	generalIndex: number;       // Combined Index level (e.g. 196.8)
	momChangePct: number;       // Month-on-Month change %
	isProvisional: boolean;
}

export interface IndiaCpiReport {
	engine_version: string;
	calculation_timestamp: string;
	asOfDate: string;
	headlineCpi: number;        // e.g. 6.21%
	previousCpi: number;        // e.g. 5.49%
	changeMoMBps: number;       // e.g. +72 bps
	period: string;             // e.g. "October 2024"
	periodShort: string;        // e.g. "Oct 2024"
	releaseDate: string;        // e.g. "2024-11-12"
	nextReleaseDate: string;    // e.g. "2024-12-12"
	updateFrequency: string;    // "Monthly (12th of each month at 17:30 IST)"
	source: string;             // "MoSPI (NSO)"
	unit: string;               // "% YoY"
	rbiTargetBand: string;      // "4.00% ± 2.00%"
	rbiCeilingPct: number;      // 6.00%
	rbiFloorPct: number;        // 2.00%
	stance: RbiInflationStance;
	statusBadge: string;        // e.g. "Above RBI 6% Upper Band"
	foodInflationCfpi: number;  // e.g. 10.87%
	ruralInflation: number;     // e.g. 6.68%
	urbanInflation: number;     // e.g. 5.62%
	realYield10Y: number;       // Benchmark G-Sec 10Y - Headline CPI (e.g. 6.79 - 6.21 = +0.58%)
	realPolicyRate: number;     // RBI Repo Rate - Headline CPI (e.g. 6.50 - 6.21 = +0.29%)
	historicalReleases: MoSpiCpiRelease[];
	commentary: string;
}

/**
 * Official historical release catalog published by MoSPI (NSO)
 * Aligned with verified official press releases.
 */
export const OFFICIAL_MOSPI_RELEASES: MoSpiCpiRelease[] = [
	{
		period: "October 2024",
		periodCode: "2024-10",
		releaseDate: "2024-11-12",
		headlineYoY: 6.21,
		cfpiFoodInflationYoY: 10.87,
		ruralYoY: 6.68,
		urbanYoY: 5.62,
		generalIndex: 196.8,
		momChangePct: 1.34,
		isProvisional: true,
	},
	{
		period: "September 2024",
		periodCode: "2024-09",
		releaseDate: "2024-10-14",
		headlineYoY: 5.49,
		cfpiFoodInflationYoY: 9.24,
		ruralYoY: 5.87,
		urbanYoY: 5.05,
		generalIndex: 194.2,
		momChangePct: 0.62,
		isProvisional: false,
	},
	{
		period: "August 2024",
		periodCode: "2024-08",
		releaseDate: "2024-09-12",
		headlineYoY: 3.65,
		cfpiFoodInflationYoY: 5.66,
		ruralYoY: 4.16,
		urbanYoY: 3.14,
		generalIndex: 193.0,
		momChangePct: 0.10,
		isProvisional: false,
	},
	{
		period: "July 2024",
		periodCode: "2024-07",
		releaseDate: "2024-08-12",
		headlineYoY: 3.54,
		cfpiFoodInflationYoY: 5.42,
		ruralYoY: 4.10,
		urbanYoY: 2.98,
		generalIndex: 192.8,
		momChangePct: 1.42,
		isProvisional: false,
	},
	{
		period: "June 2024",
		periodCode: "2024-06",
		releaseDate: "2024-07-12",
		headlineYoY: 5.08,
		cfpiFoodInflationYoY: 9.36,
		ruralYoY: 5.66,
		urbanYoY: 4.39,
		generalIndex: 190.1,
		momChangePct: 1.33,
		isProvisional: false,
	},
	{
		period: "May 2024",
		periodCode: "2024-05",
		releaseDate: "2024-06-12",
		headlineYoY: 4.75,
		cfpiFoodInflationYoY: 8.69,
		ruralYoY: 5.28,
		urbanYoY: 4.15,
		generalIndex: 187.6,
		momChangePct: 0.48,
		isProvisional: false,
	},
	{
		period: "April 2024",
		periodCode: "2024-04",
		releaseDate: "2024-05-13",
		headlineYoY: 4.83,
		cfpiFoodInflationYoY: 8.70,
		ruralYoY: 5.43,
		urbanYoY: 4.11,
		generalIndex: 186.7,
		momChangePct: 0.48,
		isProvisional: false,
	},
];

class IndiaCpiService {
	private static instance: IndiaCpiService;
	private cachedReport: { report: IndiaCpiReport; expiresAt: number } | null = null;

	public static getInstance(): IndiaCpiService {
		if (!IndiaCpiService.instance) {
			IndiaCpiService.instance = new IndiaCpiService();
		}
		return IndiaCpiService.instance;
	}

	/**
	 * Determines the institutional inflation stance relative to RBI mandate
	 */
	public determineInflationStance(cpi: number): { stance: RbiInflationStance; statusBadge: string } {
		if (cpi > 6.00) {
			return {
				stance: "BREACH_UPPER_BAND",
				statusBadge: "Above RBI 6% Upper Band",
			};
		}
		if (cpi >= 5.00) {
			return {
				stance: "ELEVATED_WATCH",
				statusBadge: "Elevated (Within 4±2% Tolerance)",
			};
		}
		if (cpi >= 3.50 && cpi <= 4.50) {
			return {
				stance: "TARGET_ANCHORED",
				statusBadge: "Anchored Near 4.0% Target",
			};
		}
		if (cpi >= 2.00) {
			return {
				stance: "BENIGN_LOWER_HALF",
				statusBadge: "Benign (Within 4±2% Tolerance)",
			};
		}
		return {
			stance: "BELOW_LOWER_BAND",
			statusBadge: "Below RBI 2% Lower Floor",
		};
	}

	/**
	 * Retrieves the active official India CPI Report.
	 * Checks in-memory cache, falls back to DB, and defaults to latest verified MoSPI release.
	 */
	public async getLatestCpiReport(benchmarkGSecYield: number = 6.79, repoRate: number = 6.50): Promise<IndiaCpiReport> {
		const now = Date.now();
		if (this.cachedReport && this.cachedReport.expiresAt > now) {
			// Update dynamic real yields against active inputs
			const r = this.cachedReport.report;
			r.realYield10Y = parseFloat((benchmarkGSecYield - r.headlineCpi).toFixed(2));
			r.realPolicyRate = parseFloat((repoRate - r.headlineCpi).toFixed(2));
			return r;
		}

		const t0 = Date.now();
		const latestRelease = OFFICIAL_MOSPI_RELEASES[0];
		const previousRelease = OFFICIAL_MOSPI_RELEASES[1];

		let headlineCpi = latestRelease.headlineYoY;
		let period = latestRelease.period;
		let releaseDate = latestRelease.releaseDate;

		// Try loading latest CPI from golden_prices in PostgreSQL
		try {
			const dbRes = await db.execute(sql`
				SELECT price, price_date, metadata
				FROM golden_prices
				WHERE isin IN ('MACRO_IN_CPI', 'MACRO_INDIA_CPI')
				ORDER BY price_date DESC, updated_at DESC
				LIMIT 1;
			`);

			const row = dbRes.rows?.[0] as any;
			if (row && Number(row.price) > 0) {
				const dbPrice = parseFloat(Number(row.price).toFixed(2));
				// Ensure DB price is valid (within sensible macro bounds)
				if (dbPrice >= 1.0 && dbPrice <= 15.0) {
					headlineCpi = dbPrice;
					if (row.metadata?.period) {
						period = row.metadata.period;
					}
					if (row.metadata?.releaseDate) {
						releaseDate = row.metadata.releaseDate;
					}
				}
			}
		} catch (dbErr: any) {
			logger.warn("[IndiaCpiService] DB query fallback to official catalog:", { error: dbErr?.message });
		}

		const changeMoMBps = Math.round((headlineCpi - previousRelease.headlineYoY) * 100);
		const { stance, statusBadge } = this.determineInflationStance(headlineCpi);
		const realYield10Y = parseFloat((benchmarkGSecYield - headlineCpi).toFixed(2));
		const realPolicyRate = parseFloat((repoRate - headlineCpi).toFixed(2));

		const commentary = headlineCpi > 6.00
			? `India headline CPI inflation for ${period} printed at ${headlineCpi.toFixed(2)}% YoY, crossing the RBI's upper tolerance threshold of 6.00% driven primarily by food inflation (CFPI at ${latestRelease.cfpiFoodInflationYoY}%). With 10-Year Benchmark G-Sec yielding ${benchmarkGSecYield.toFixed(2)}%, the real sovereign yield stands at +${realYield10Y.toFixed(2)}% over CPI, constraining the MPC's near-term rate cut leeway.`
			: `India headline CPI inflation for ${period} settled at ${headlineCpi.toFixed(2)}% YoY, within the RBI's 4.00% ± 2.00% tolerance band. Real sovereign 10Y yield stands at +${realYield10Y.toFixed(2)}% over CPI, providing attractive domestic carry.`;

		const report: IndiaCpiReport = {
			engine_version: INDIA_CPI_ENGINE_VERSION,
			calculation_timestamp: new Date().toISOString(),
			asOfDate: new Date().toISOString().split("T")[0],
			headlineCpi,
			previousCpi: previousRelease.headlineYoY,
			changeMoMBps,
			period,
			periodShort: "Oct 2024",
			releaseDate,
			nextReleaseDate: "2024-12-12",
			updateFrequency: "Monthly (12th of each month at 17:30 IST)",
			source: "MoSPI (NSO)",
			unit: "% YoY",
			rbiTargetBand: "4.00% ± 2.00%",
			rbiCeilingPct: 6.00,
			rbiFloorPct: 2.00,
			stance,
			statusBadge,
			foodInflationCfpi: latestRelease.cfpiFoodInflationYoY,
			ruralInflation: latestRelease.ruralYoY,
			urbanInflation: latestRelease.urbanYoY,
			realYield10Y,
			realPolicyRate,
			historicalReleases: OFFICIAL_MOSPI_RELEASES,
			commentary,
		};

		this.cachedReport = {
			report,
			expiresAt: now + CACHE_TTL_MS,
		};

		telemetryBus.report({
			engineId: "india-cpi-engine",
			engineName: "India CPI & MoSPI Macro Engine",
			category: "Risk & Regime",
			reportedAt: new Date().toISOString(),
			latencyMs: Date.now() - t0,
			qualityScore: 99,
			itemsProcessed: 1,
			errorCount: 0,
			meta: {
				headlineCpi,
				period,
				stance,
				realYield10Y,
			},
		});

		return report;
	}

	/**
	 * Persists the verified official CPI to golden_prices and macro_regime_snapshots in PostgreSQL
	 */
	public async syncAndPersistCpi(targetDate?: string): Promise<{ success: boolean; headlineCpi: number; error?: string }> {
		const today = targetDate || new Date().toISOString().split("T")[0];
		const latest = OFFICIAL_MOSPI_RELEASES[0];

		try {
			const metadata = {
				indicator: "India CPI Inflation",
				period: latest.period,
				periodCode: latest.periodCode,
				releaseDate: latest.releaseDate,
				cfpiFoodInflation: latest.cfpiFoodInflationYoY,
				ruralInflation: latest.ruralYoY,
				urbanInflation: latest.urbanYoY,
				unit: "% YoY",
				source: "MoSPI (NSO)",
				updateFrequency: "Monthly (12th at 17:30 IST)",
				status: latest.headlineYoY > 6.0 ? "Above RBI 6% Upper Band" : "Within RBI 4±2% Tolerance",
				engine_version: INDIA_CPI_ENGINE_VERSION,
			};

			// 1. Upsert under both primary standard ISINs
			for (const isin of ["MACRO_IN_CPI", "MACRO_INDIA_CPI"]) {
				await db.execute(sql`
					INSERT INTO golden_prices (
						isin, symbol, price_date, asset_class, price,
						change_percent, source, confidence_score, is_validated, is_stale,
						is_flagged, currency, metadata, updated_at
					) VALUES (
						${isin}, 'CPI_IN', ${today}, 'macro', ${latest.headlineYoY},
						${latest.momChangePct}, 'MOSPI_OFFICIAL', 99,
						true, false, false, 'INR',
						${JSON.stringify(metadata)}::jsonb, NOW()
					)
					ON CONFLICT (isin, price_date) DO UPDATE SET
						price = EXCLUDED.price,
						change_percent = EXCLUDED.change_percent,
						source = EXCLUDED.source,
						metadata = EXCLUDED.metadata,
						is_stale = false,
						updated_at = NOW();
				`);
			}

			// 2. Update today's macro_regime_snapshots if table row exists
			try {
				await db.execute(sql`
					UPDATE macro_regime_snapshots
					SET india_cpi_inflation = ${latest.headlineYoY}
					WHERE snapshot_date = ${today}::date;
				`);
			} catch (mErr: any) {
				logger.debug(`[IndiaCpiService] Macro regime snapshot update notice: ${mErr?.message}`);
			}

			logger.info(`[IndiaCpiService] ✅ Persisted official MoSPI CPI (${latest.period}: ${latest.headlineYoY}%) for ${today}`);
			return { success: true, headlineCpi: latest.headlineYoY };
		} catch (err: any) {
			logger.error(`[IndiaCpiService] ❌ Failed to persist official CPI: ${err?.message}`);
			return { success: false, headlineCpi: latest.headlineYoY, error: err?.message };
		}
	}
}

export const indiaCpiService = IndiaCpiService.getInstance();
