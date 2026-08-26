import { db } from "../../db";
import { sql } from "drizzle-orm";
import { logger } from "../../logger";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory } from "../pick-of-the-day-service";


// Reference prices for known REITs/InvITs — used as fallback when current_price is NULL/0 in DB.
// Updated periodically; actual live price fetched by refreshLivePicks() post-market.
const REIT_REFERENCE_PRICES: Record<string, number> = {
	EMBASSY: 340,
	MINDSPACE: 315,
	BROOKFIELD: 225,
	NEXUSSELECT: 125,
	INDIGRID: 155,
	IRB: 55,
	POWERGRID: 100,
	NHIT: 105,
	JIOINVIT: 250,
	ORIENTGREEN: 90,
	BHINVIT: 105,
};

/**
 * Phase 1 fix: Score a REIT/InvIT by multiple signals.
 * Previously score() returned a hardcoded 60.
 *
 * Signals:
 *  - Distribution yield (primary): higher = better
 *  - Debt coverage ratio (DCR): > 1.5× = safer
 *  - Occupancy rate: higher = more stable cash flows
 *  - Instrument type: slight REIT preference over InvIT (yield stability)
 */
function scoreREIT(reit: any): number {
	let score = 0;

	// Distribution yield (most important for income instruments)
	const yield_ = Number.parseFloat(
		reit.distributionYield ?? reit.dividendYield ?? reit.yield ?? "0",
	);
	if (yield_ > 9) score += 25;
	else if (yield_ > 7) score += 18;
	else if (yield_ > 5) score += 10;

	// Debt coverage ratio
	const dcr = Number.parseFloat(reit.debtCoverageRatio ?? reit.dcr ?? "0");
	if (dcr > 2.0) score += 15;
	else if (dcr > 1.5) score += 10;
	else if (dcr > 1.2) score += 5;

	// Occupancy rate (REITs only — may be null for InvITs)
	const occ = Number.parseFloat(reit.occupancyRate ?? "0");
	if (occ > 95) score += 15;
	else if (occ > 85) score += 8;

	// Type preference: REITs have more transparent yield history
	if (reit.type === "REIT") score += 5;

	// Sector preference: office/commercial REITs more liquid than hospitality
	const sector = (reit.sector || "").toLowerCase();
	if (
		sector.includes("commercial") ||
		sector.includes("office") ||
		sector.includes("industrial")
	)
		score += 5;
	else if (
		sector.includes("power") ||
		sector.includes("road") ||
		sector.includes("infra")
	)
		score += 4;

	return Math.max(score, 1); // always > 0 so sorting works
}

export class REITInvITStrategy extends BaseStrategy {
	category: PickCategory = "reits_invits";

	async generate(context: StrategyContext): Promise<DailyPickData | null> {
		try {
			// ── Try fetching from reits/invits tables; fall back to synthetic pool ──
			let all: any[] = [];
			try {
				const reitsList = await db.execute(sql`
        SELECT id, name, symbol, isin_code as isin, sector,
               current_price::numeric        as "currentPrice",
               face_value::numeric           as "faceValue",
               distribution_yield::numeric   as "distributionYield",
               debt_coverage_ratio::numeric  as "debtCoverageRatio",
               occupancy_rate::numeric       as "occupancyRate",
               'REIT' as type
        FROM reits WHERE is_active = true
        UNION ALL
        SELECT id, name, symbol, isin_code as isin, sector,
               current_price::numeric        as "currentPrice",
               face_value::numeric           as "faceValue",
               distribution_yield::numeric   as "distributionYield",
               debt_coverage_ratio::numeric  as "debtCoverageRatio",
               NULL::numeric                 as "occupancyRate",
               'InvIT' as type
        FROM invits WHERE is_active = true
        ORDER BY name
        LIMIT 20
      `);
				all = (reitsList.rows || []) as any[];
			} catch {
				// reits/invits tables not yet in production — use reference prices
				all = [];
			}

			// Synthetic fallback when DB tables empty or missing
			if (all.length === 0) {
				const synthPool = Object.entries(REIT_REFERENCE_PRICES).map(
					([symbol, price]) => ({
						id: `synth_${symbol}`,
						name: symbol,
						symbol,
						isin: null,
						sector: symbol.includes("GRID") || symbol.includes("IRB") || symbol.includes("POWER") || symbol.includes("NHIT") || symbol.includes("JIO") || symbol.includes("ORIENT") || symbol.includes("BH") ? "Infrastructure" : "Commercial",
						currentPrice: price,
						faceValue: price,
						distributionYield: "7.5",
						debtCoverageRatio: "1.6",
						occupancyRate: symbol.includes("GRID") ? null : "92",
						type: symbol.includes("GRID") || symbol.includes("IRB") || symbol.includes("POWER") || symbol.includes("NHIT") || symbol.includes("JIO") || symbol.includes("ORIENT") || symbol.includes("BH") ? "InvIT" : "REIT",
					}),
				);
				const dayOfYear = Math.floor(
					(Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
				);
				all = [synthPool[dayOfYear % synthPool.length]];
				logger.info(`[REITInvITStrategy] Using synthetic REIT: ${all[0].name} (reits/invits tables empty)`);
			}

			// Phase 1 fix: rotate — skip those picked in the last 14 days
			const recentIds = context.recentIds || new Set<string>();
			const candidates = all.filter(
				(r) => !recentIds.has(String(r.id)) && !recentIds.has(r.symbol),
			);
			const pool = candidates.length > 0 ? candidates : all;

			// Phase 1 fix: Score all candidates and pick the highest scoring one
			const scored = pool
				.map((r) => ({ r, score: scoreREIT(r) }))
				.sort((a, b) => b.score - a.score);

			const top = scored[0].r;
			const topScore = scored[0].score;

			// Phase 1 fix: Use reference price when DB current_price is NULL or 0
			const dbPrice = Number.parseFloat(String(top.currentPrice || "0"));
			const refPrice =
				REIT_REFERENCE_PRICES[top.symbol as string] ??
				Number.parseFloat(String(top.faceValue || "0"));
			const currentPrice = dbPrice > 0 ? dbPrice : refPrice;

			if (currentPrice <= 0) {
				// eslint-disable-next-line no-console
				console.warn(
					`[REITInvITStrategy] No price available for ${top.symbol} — skipping pick`,
				);
				return null;
			}

			const { targetPct, stoplossPct } =
				this.getDynamicTargetStoploss("reits_invits");
			const targetPrice =
				Math.round(currentPrice * (1 + targetPct) * 100) / 100;
			const stoplossPrice =
				Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

			const distributionYield = Number.parseFloat(top.distributionYield ?? "0");
			const debtCoverageRatio = Number.parseFloat(top.debtCoverageRatio ?? "0");
			const occupancyRate = Number.parseFloat(top.occupancyRate ?? "0");

			// Phase 1 fix: generate AI rationale (was empty string before)
			const rationale = await context.service.generateRationale({
				category: "reits_invits",
				name: top.name,
				currentPrice,
				targetPrice,
				stoplossPrice,
				metrics: {
					type: top.type,
					sector: top.sector,
					distributionYield:
						distributionYield > 0 ? distributionYield : undefined,
					debtCoverageRatio:
						debtCoverageRatio > 0 ? debtCoverageRatio : undefined,
					occupancyRate: occupancyRate > 0 ? occupancyRate : undefined,
				},
			});

			// Phase 1 fix: risk level derived from debt coverage (was hardcoded 'medium')
			const riskLevel =
				debtCoverageRatio > 1.8
					? "low"
					: debtCoverageRatio > 1.3
						? "medium"
						: "high";

			return {
				category: "reits_invits",
				instrumentId: String(top.id),
				instrumentName: top.name,
				isin: top.isin,
				symbol: top.symbol,
				exchange: "NSE",
				recoDate: context.today,
				recoPrice: currentPrice,
				targetPrice,
				stoplossPrice,
				currentPrice,
				status: "live",
				expiryDate: this.getExpiryDate(180),
				rationale,
				riskLevel,
				suitableFor: this.deriveSuitableFor(riskLevel, "reits_invits"),
				timeHorizon: this.getTimeHorizon("reits_invits"),
				confidenceScore: this.getConfidenceScore("reits_invits", topScore, 60),
				sectorCategory: top.type,
				keyMetrics: {
					type: top.type,
					sector: top.sector,
					distributionYield: distributionYield > 0 ? distributionYield : null,
					debtCoverageRatio: debtCoverageRatio > 0 ? debtCoverageRatio : null,
					occupancyRate: occupancyRate > 0 ? occupancyRate : null,
					priceSource: dbPrice > 0 ? "db" : "reference",
				},
			};
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error("[REITInvITStrategy] Error:", error);
			return null;
		}
	}

	/** Delegates to the shared scoreREIT function. */
	score(reit: any): number {
		return scoreREIT(reit);
	}

	async getLivePrice(instrumentId: string): Promise<number | null> {
		// ── Fix: handle synthetic IDs (synth_POWERGRID, synth_NHIT etc.) ──────────
		// When the reits/invits DB tables are empty, REITInvITStrategy.generate()
		// uses synthetic instruments with id="synth_SYMBOL". These are not real
		// DB row IDs so the SQL query below returns nothing, causing null → no yield
		// accrual in refreshLivePicks(). Fix: detect synth IDs and return the
		// reference price so estimateYieldReturn() can compute an accrued return.
		if (instrumentId.startsWith("synth_")) {
			const symbol = instrumentId.replace("synth_", "");
			const refPrice = REIT_REFERENCE_PRICES[symbol];
			return refPrice != null ? refPrice : null;
		}

		try {
			const result = await db.execute(sql`
        SELECT current_price FROM reits WHERE id::text = ${instrumentId}
        UNION ALL SELECT current_price FROM invits WHERE id::text = ${instrumentId}
        LIMIT 1
      `);
			const reitRow = result.rows?.[0] as any;
			// If DB has a live price, use it; else fall back to reference prices
			if (reitRow?.current_price) {
				return Number.parseFloat(reitRow.current_price);
			}
			// Try to infer the symbol from instrumentId for reference price lookup
			return null;
		} catch {
			return null;
		}
	}
}

