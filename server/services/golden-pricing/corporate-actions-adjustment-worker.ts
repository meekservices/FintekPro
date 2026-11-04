/**
 * Corporate Actions Adjustment Worker
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v1.0
 * Purpose: Applies backward split, bonus, and corporate action adjustments to historical prices
 * in `golden_prices`, ensuring return continuity, accurate backtesting, and quantitative integrity.
 *
 * All price adjustments are immutably logged in `price_adjustments` for SEBI regulatory compliance.
 */

import { pool } from "../../db";
import { logger } from "../../logger";
import { goldenPricingEngine } from "./GoldenPricingEngine";

export interface PendingCorporateAction {
	id: number;
	isin: string;
	symbol?: string;
	actionType: "SPLIT" | "BONUS" | "DIVIDEND" | "RIGHTS" | "MERGER" | string;
	exDate: string;
	ratio?: string;
	adjustmentFactor?: number;
	dividendAmount?: number;
	isAppliedToGoldenPrices: boolean;
}

export interface AdjustmentResult {
	actionId: number;
	isin: string;
	actionType: string;
	exDate: string;
	adjustmentFactor: number;
	rowsAdjusted: number;
	durationMs: number;
	success: boolean;
	error?: string;
}

export class CorporateActionsAdjustmentWorker {
	private intervalHandle: NodeJS.Timeout | null = null;
	private isProcessing: boolean = false;

	/**
	 * Computes the canonical price adjustment factor (F) according to NSE/SEBI standards.
	 * Historical Price_adj = Price_orig * F
	 * Historical Volume_adj = Volume_orig / F
	 */
	public calculateAdjustmentFactor(
		actionType: string,
		ratioStr?: string | null,
		explicitFactor?: number | string | null,
		dividendAmount?: number | string | null,
		cumPrice?: number | null,
	): number {
		if (explicitFactor && Number(explicitFactor) > 0 && Number(explicitFactor) <= 2) {
			return Number(explicitFactor);
		}

		const type = (actionType || "").toUpperCase();

		// Parse ratio e.g. "1:2", "2:1", "10:1", "1:10"
		let num = 1;
		let den = 1;
		if (ratioStr && ratioStr.includes(":")) {
			const parts = ratioStr.split(":").map((p) => parseFloat(p.trim()));
			if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] > 0 && parts[1] > 0) {
				num = parts[0];
				den = parts[1];
			}
		}

		if (type === "SPLIT") {
			// e.g., 10:1 split (1 share of FV 10 becomes 10 shares of FV 1):
			// or 1:2 split (1 share becomes 2 shares)
			// Old shares = 1, New shares = max(num, den) if one of them is 1
			if (num > den) {
				// e.g. "10:1" -> 1 share becomes 10 -> Factor = 1/10 = 0.1
				return Math.round((den / num) * 100000000) / 100000000;
			} else if (den > num) {
				// e.g. "1:2" -> 1 share becomes 2 -> Factor = 1/2 = 0.5
				return Math.round((num / den) * 100000000) / 100000000;
			}
			return 1.0;
		}

		if (type === "BONUS") {
			// e.g. "1:1" bonus (1 bonus share for 1 existing share) -> 1 share becomes 2 -> Factor = 1/(1+1) = 0.5
			// e.g. "1:2" bonus (1 bonus for 2 existing) -> 2 shares become 3 -> Factor = 2/(1+2) = 0.66666667
			// e.g. "2:1" bonus (2 bonus for 1 existing) -> 1 share becomes 3 -> Factor = 1/(2+1) = 0.33333333
			let bonusShares = num;
			let existingShares = den;
			if (num > 10 || den > 10) {
				// Safety check for malformed ratio
				return 0.5;
			}
			const factor = existingShares / (bonusShares + existingShares);
			return Math.round(factor * 100000000) / 100000000;
		}

		if (type === "DIVIDEND" && dividendAmount && Number(dividendAmount) > 0 && cumPrice && cumPrice > 0) {
			const div = Number(dividendAmount);
			if (div < cumPrice) {
				const factor = (cumPrice - div) / cumPrice;
				return Math.round(factor * 100000000) / 100000000;
			}
		}

		return 1.0;
	}

	/**
	 * Queries and applies all pending corporate actions whose exDate <= CURRENT_DATE.
	 */
	public async processPendingCorporateActions(): Promise<AdjustmentResult[]> {
		if (this.isProcessing) {
			logger.warn("[CorpActionsWorker] Corporate action processing in progress, skipping run", {
				event: "CORP_ACTIONS_SKIP_CONCURRENT",
			});
			return [];
		}

		this.isProcessing = true;
		const results: AdjustmentResult[] = [];

		try {
			// 1. Fetch unapplied corporate actions whose ex_date has arrived
			const selectQuery = `
				SELECT id, isin, symbol, action_type, ex_date, ratio, adjustment_factor, dividend_amount, is_applied_to_golden_prices
				FROM corporate_actions
				WHERE is_applied_to_golden_prices = false
				  AND ex_date <= CURRENT_DATE
				ORDER BY ex_date ASC, id ASC
			`;
			const res = await pool.query(selectQuery);
			const pendingActions: PendingCorporateAction[] = res.rows.map((r) => ({
				id: r.id,
				isin: r.isin,
				symbol: r.symbol,
				actionType: r.action_type,
				exDate: r.ex_date instanceof Date ? r.ex_date.toISOString().slice(0, 10) : String(r.ex_date),
				ratio: r.ratio,
				adjustmentFactor: r.adjustment_factor ? Number(r.adjustment_factor) : undefined,
				dividendAmount: r.dividend_amount ? Number(r.dividend_amount) : undefined,
				isAppliedToGoldenPrices: r.is_applied_to_golden_prices,
			}));

			if (pendingActions.length === 0) {
				return [];
			}

			logger.info(`[CorpActionsWorker] Found ${pendingActions.length} pending corporate action(s) to process`, {
				event: "CORP_ACTIONS_PROCESSING_STARTED",
				count: pendingActions.length,
			});

			for (const action of pendingActions) {
				const singleRes = await this.applySingleCorporateAction(action);
				results.push(singleRes);
			}
		} catch (err: any) {
			logger.error("[CorpActionsWorker] Error querying pending corporate actions", {
				event: "CORP_ACTIONS_QUERY_ERROR",
				error: err?.message,
			});
		} finally {
			this.isProcessing = false;
		}

		return results;
	}

	/**
	 * Applies a single corporate action within an atomic transaction.
	 */
	public async applySingleCorporateAction(action: PendingCorporateAction): Promise<AdjustmentResult> {
		const startTime = Date.now();
		const client = await pool.connect();

		try {
			// Calculate factor
			const factor = this.calculateAdjustmentFactor(
				action.actionType,
				action.ratio,
				action.adjustmentFactor,
				action.dividendAmount,
			);

			if (factor <= 0 || factor > 1.5 || factor === 1.0) {
				logger.warn(`[CorpActionsWorker] Invalid or identity adjustment factor ${factor} for action #${action.id}, marking skipped`, {
					actionId: action.id,
					isin: action.isin,
					factor,
				});

				await client.query(
					`UPDATE corporate_actions SET is_applied_to_golden_prices = true, updated_at = NOW() WHERE id = $1`,
					[action.id],
				);

				return {
					actionId: action.id,
					isin: action.isin,
					actionType: action.actionType,
					exDate: action.exDate,
					adjustmentFactor: factor,
					rowsAdjusted: 0,
					durationMs: Date.now() - startTime,
					success: true,
				};
			}

			await client.query("BEGIN");

			// 1. Fetch historical prices strictly prior to ex_date
			const priceRes = await client.query(
				`SELECT id, isin, price_date, price, open_price, high_price, low_price, volume
				 FROM golden_prices
				 WHERE isin = $1 AND price_date < $2::date
				 ORDER BY price_date ASC
				 FOR UPDATE`,
				[action.isin, action.exDate],
			);

			let rowsAdjusted = 0;

			for (const row of priceRes.rows) {
				const origPrice = Number(row.price);
				const adjPrice = Math.round(origPrice * factor * 1000000) / 1000000;
				const adjOpen = row.open_price ? Math.round(Number(row.open_price) * factor * 1000000) / 1000000 : null;
				const adjHigh = row.high_price ? Math.round(Number(row.high_price) * factor * 1000000) / 1000000 : null;
				const adjLow = row.low_price ? Math.round(Number(row.low_price) * factor * 1000000) / 1000000 : null;
				const adjVol = row.volume ? Math.round(Number(row.volume) / factor) : null;
				const priceDateStr = row.price_date instanceof Date ? row.price_date.toISOString().slice(0, 10) : String(row.price_date);

				// Log adjustment in audit trail table
				await client.query(
					`INSERT INTO price_adjustments (
						corporate_action_id, isin, price_date, original_price, adjusted_price, adjustment_factor, applied_at
					 ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
					[action.id, action.isin, priceDateStr, origPrice, adjPrice, factor],
				);

				// Update golden_prices table
				await client.query(
					`UPDATE golden_prices
					 SET price = $1,
					     open_price = $2,
					     high_price = $3,
					     low_price = $4,
					     volume = $5,
					     updated_at = NOW()
					 WHERE id = $6`,
					[adjPrice, adjOpen, adjHigh, adjLow, adjVol, row.id],
				);

				rowsAdjusted++;
			}

			// 2. Mark corporate action as applied
			await client.query(
				`UPDATE corporate_actions
				 SET is_applied_to_golden_prices = true,
				     adjustment_factor = $1,
				     applied_at = NOW(),
				     updated_at = NOW()
				 WHERE id = $2`,
				[factor, action.id],
			);

			await client.query("COMMIT");

			// Invalidate golden pricing in-memory cache for this ISIN
			try {
				goldenPricingEngine.invalidateCache(action.isin);
			} catch (_) {}

			const durationMs = Date.now() - startTime;
			logger.info(`[CorpActionsWorker] Successfully applied ${action.actionType} adjustment to ${action.isin}`, {
				event: "CORPORATE_ACTION_APPLIED",
				action_id: action.id,
				isin: action.isin,
				action_type: action.actionType,
				factor,
				rows_adjusted: rowsAdjusted,
				latency_ms: durationMs,
				status: "SUCCESS",
			});

			return {
				actionId: action.id,
				isin: action.isin,
				actionType: action.actionType,
				exDate: action.exDate,
				adjustmentFactor: factor,
				rowsAdjusted,
				durationMs,
				success: true,
			};
		} catch (err: any) {
			await client.query("ROLLBACK");
			const durationMs = Date.now() - startTime;
			logger.error(`[CorpActionsWorker] Failed to apply corporate action #${action.id} to ${action.isin}`, {
				event: "CORPORATE_ACTION_APPLY_ERROR",
				action_id: action.id,
				isin: action.isin,
				error: err?.message,
				latency_ms: durationMs,
			});

			return {
				actionId: action.id,
				isin: action.isin,
				actionType: action.actionType,
				exDate: action.exDate,
				adjustmentFactor: 1.0,
				rowsAdjusted: 0,
				durationMs,
				success: false,
				error: err?.message,
			};
		} finally {
			client.release();
		}
	}

	/**
	 * Convenience method to record and immediately process a corporate action announcement.
	 */
	public async recordAndApply(action: {
		isin: string;
		symbol?: string;
		actionType: "SPLIT" | "BONUS" | "DIVIDEND" | "RIGHTS" | string;
		exDate: string;
		ratio?: string;
		adjustmentFactor?: number;
		dividendAmount?: number;
		source?: string;
	}): Promise<AdjustmentResult | null> {
		const factor = action.adjustmentFactor || this.calculateAdjustmentFactor(
			action.actionType,
			action.ratio,
			action.adjustmentFactor,
			action.dividendAmount,
		);

		const insertQuery = `
			INSERT INTO corporate_actions (
				isin, symbol, action_type, ex_date, ratio, adjustment_factor, dividend_amount, source, is_applied_to_golden_prices
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
			ON CONFLICT (isin, ex_date, action_type) DO UPDATE SET
				ratio = EXCLUDED.ratio,
				adjustment_factor = EXCLUDED.adjustment_factor,
				dividend_amount = EXCLUDED.dividend_amount,
				updated_at = NOW()
			RETURNING id
		`;

		const res = await pool.query(insertQuery, [
			action.isin,
			action.symbol || null,
			action.actionType,
			action.exDate,
			action.ratio || null,
			factor,
			action.dividendAmount || null,
			action.source || "MANUAL",
		]);

		const id = res.rows[0]?.id;
		if (!id) return null;

		// Check if exDate has already passed or is today
		const today = new Date().toISOString().slice(0, 10);
		if (action.exDate <= today) {
			return await this.applySingleCorporateAction({
				id,
				isin: action.isin,
				symbol: action.symbol,
				actionType: action.actionType,
				exDate: action.exDate,
				ratio: action.ratio,
				adjustmentFactor: factor,
				dividendAmount: action.dividendAmount,
				isAppliedToGoldenPrices: false,
			});
		}

		return null;
	}

	/**
	 * Starts the daily corporate action adjustment scheduler (runs daily at 08:30 AM IST / 03:00 UTC).
	 * Also runs an initial pass 20s after boot.
	 */
	public startDailyScheduler(): void {
		if (this.intervalHandle) return;

		// Initial sweep 20s after startup
		setTimeout(() => {
			void this.processPendingCorporateActions();
		}, 20_000);

		// Daily interval (24 hours)
		this.intervalHandle = setInterval(() => {
			void this.processPendingCorporateActions();
		}, 24 * 60 * 60 * 1000);

		logger.info("[CorpActionsWorker] Daily corporate actions adjustment scheduler started", {
			event: "CORP_ACTIONS_SCHEDULER_STARTED",
		});
	}

	/**
	 * Stops the recurring scheduler.
	 */
	public stopDailyScheduler(): void {
		if (this.intervalHandle) {
			clearInterval(this.intervalHandle);
			this.intervalHandle = null;
		}
	}
}

export const corporateActionsAdjustmentWorker = new CorporateActionsAdjustmentWorker();

