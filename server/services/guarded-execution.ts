/**
 * FintekPro Guarded Execution Engine
 *
 * Embeds self-healing DIRECTLY inside the Pricing and Prospect engines.
 * Unlike the side-channel approach, this wrapper:
 *
 *  1. Catches errors at execution time (zero latency detection)
 *  2. Returns a typed fallback immediately — caller never waits on recovery
 *  3. Fires async auto-recovery + validation feedback (non-blocking)
 *  4. Applies financial / data-schema validators BEFORE returning results
 *  5. Routes errors by risk level (pricing = medium, orders = high, prospect = low)
 *
 * Usage:
 *   const price = await guardedExecution(
 *     () => alpacaApi(symbol),
 *     {
 *       module: 'pricing_engine',
 *       operation: 'alpaca_quote',
 *       input: { symbol },
 *       fallback: null,
 *       validator: (p) => { validateStockPrice(p.price, symbol); return p; },
 *     }
 *   );
 */

import { handleErrorWithAutoRecovery } from "./auto-recovery-service";
import { db } from "../db";
import { sql } from "drizzle-orm";

// ── Module types & risk levels ────────────────────────────────────────────────

export type GuardedModule =
	| "pricing_engine"
	| "prospect_engine"
	| "portfolio_engine"
	| "order_engine"
	| "data_enrichment";

type RiskLevel = "low" | "medium" | "high";

const MODULE_RISK: Record<GuardedModule, RiskLevel> = {
	order_engine: "high", // never auto-fix; always flag for review
	portfolio_engine: "high", // portfolio calcs → approval required
	pricing_engine: "medium", // market data → auto-fallback ok; log for review
	data_enrichment: "low", // enrichment scrapers → auto-fix aggressively
	prospect_engine: "low", // scrapers/APIs → auto-fix aggressively
};

// ── Context definition ────────────────────────────────────────────────────────

export interface GuardedContext<T> {
	module: GuardedModule;
	operation: string; // e.g. 'nse_close_fetch', 'icai_scrape', 'alpaca_quote'
	input?: Record<string, unknown>;
	fallback: T; // returned immediately on error; never null-type-unsafe
	validator?: (result: T) => T; // throws on invalid data; result returned on success
	code?: string; // short description of the call (for AI analysis)
}

// ── Core wrapper ──────────────────────────────────────────────────────────────

export async function guardedExecution<T>(
	fn: () => Promise<T> | T,
	ctx: GuardedContext<T>,
): Promise<T> {
	const start = Date.now();

	try {
		const result = await fn();

		// Validate result before returning (financial / schema validation)
		if (
			ctx.validator !== undefined &&
			result !== null &&
			result !== undefined
		) {
			const validated = ctx.validator(result);
			await recordFeedback({
				...ctx,
				durationMs: Date.now() - start,
				success: true,
			});
			return validated;
		}

		await recordFeedback({
			...ctx,
			durationMs: Date.now() - start,
			success: true,
		});
		return result;
	} catch (err: any) {
		const errorMsg: string = err?.message || String(err);
		const stack: string = err?.stack || "";
		const riskLevel = MODULE_RISK[ctx.module];

		console.error(
			`[GuardedExecution] ${ctx.module}.${ctx.operation} failed (${riskLevel} risk): ${errorMsg}`,
		);

		// ── Async auto-recovery (fire-and-forget — never blocks caller) ───────────
		handleErrorWithAutoRecovery(
			`${errorMsg} ${stack}`,
			`${ctx.module}:${ctx.operation}`,
		)
			.then(({ triggered, actions }) => {
				if (triggered) {
					console.log(
						`[GuardedExecution] Auto-recovery for ${ctx.module}.${ctx.operation}: ` +
							actions.map((a) => a.action).join(", "),
					);
				}
			})
			.catch(() => {});

		// ── Feedback loop (async, best-effort) ────────────────────────────────────
		recordFeedback({
			...ctx,
			durationMs: Date.now() - start,
			success: false,
			errorMessage: errorMsg.substring(0, 500),
			riskLevel,
			fallbackUsed: ctx.fallback !== null && ctx.fallback !== undefined,
		}).catch(() => {});

		return ctx.fallback;
	}
}

// ── Financial validators (Pricing Engine) ────────────────────────────────────

/**
 * Validates a raw price number.
 * Throws if: NaN, Infinity, ≤ 0, or > ₹10 crore / $10M per unit
 */
export function validateStockPrice(price: number, symbol: string): number {
	if (!Number.isFinite(price) || Number.isNaN(price)) {
		throw new Error(`Non-finite price for ${symbol}: ${price}`);
	}
	if (price <= 0) {
		throw new Error(`Non-positive price for ${symbol}: ${price}`);
	}
	if (price > 10_000_000) {
		throw new Error(
			`Suspiciously high price for ${symbol}: ${price} — possible schema mismatch`,
		);
	}
	return price;
}

/**
 * Validates a change-percent value is within plausible intraday range (±75%).
 */
export function validateChangePercent(
	changePct: number | null | undefined,
	symbol: string,
): number | undefined {
	if (changePct === null || changePct === undefined) return undefined;
	if (!Number.isFinite(changePct)) return undefined;
	if (Math.abs(changePct) > 75) {
		throw new Error(
			`Implausible change% for ${symbol}: ${changePct}% — possible bad data`,
		);
	}
	return changePct;
}

/**
 * Validates that a quote object has the minimum required fields.
 * Throws if any required field is missing or null.
 */
export function validateQuoteSchema(
	quote: Record<string, unknown>,
	requiredFields: string[],
	context: string,
): void {
	for (const field of requiredFields) {
		if (
			!(field in quote) ||
			quote[field] === null ||
			quote[field] === undefined
		) {
			throw new Error(
				`Missing required field "${field}" in ${context} response — schema may have changed`,
			);
		}
	}
}

/**
 * Validates a NAV value (mutual fund / bond).
 */
export function validateNav(nav: number, isin: string): number {
	if (!Number.isFinite(nav) || nav <= 0) {
		throw new Error(`Invalid NAV for ISIN ${isin}: ${nav}`);
	}
	if (nav > 100_000) {
		throw new Error(`Suspiciously high NAV for ISIN ${isin}: ${nav}`);
	}
	return nav;
}

// ── Prospect validators (Prospect Engine) ────────────────────────────────────

/**
 * Validates that a prospect/member record has the minimum required fields.
 * Returns the data unchanged if valid; throws with field name if missing.
 */
export function validateProspectData<T extends Record<string, unknown>>(
	data: T,
	requiredFields: string[],
	context: string,
): T {
	for (const field of requiredFields) {
		if (!(field in data) || data[field] === null || data[field] === undefined) {
			throw new Error(
				`Prospect data missing required field "${field}" in ${context} — schema drift?`,
			);
		}
	}
	return data;
}

/**
 * Validates ICAI verification result has the minimum fields needed.
 */
export function validateICAIResult(
	result: Record<string, unknown>,
): Record<string, unknown> {
	if (!result || typeof result !== "object") {
		throw new Error(
			"ICAI result is not an object — scraper returned unexpected type",
		);
	}
	if (typeof result.success !== "boolean") {
		throw new Error('ICAI result missing "success" boolean field');
	}
	if (result.success && !result.membershipNumber) {
		throw new Error('ICAI success result missing "membershipNumber" field');
	}
	return result;
}

/**
 * Validates a Credhive company profile has minimum viable data.
 */
export function validateCredhiveProfile(
	data: Record<string, unknown>,
	cin: string,
): Record<string, unknown> {
	if (!data || typeof data !== "object") {
		throw new Error(`Credhive profile for ${cin} is not an object`);
	}
	// Either company_name or companyName must be present
	if (!data.company_name && !data.companyName && !data.name) {
		throw new Error(
			`Credhive profile for ${cin} missing company name — API response changed?`,
		);
	}
	return data;
}

// ── Smart error router ────────────────────────────────────────────────────────

/**
 * Route a module error to the appropriate fix strategy.
 * Used by the admin console to understand what kind of fix is appropriate.
 */
export function routeFixStrategy(
	module: GuardedModule,
): "AUTO_FIX" | "SCRAPER_HEALING" | "PARTIAL_AUTO" | "MANUAL_REVIEW" {
	switch (module) {
		case "prospect_engine":
		case "data_enrichment":
			return "SCRAPER_HEALING"; // aggressive auto-fix
		case "pricing_engine":
			return "PARTIAL_AUTO"; // fallback ok; alert for manual review
		case "portfolio_engine":
			return "MANUAL_REVIEW"; // never auto-fix portfolio calcs
		case "order_engine":
			return "MANUAL_REVIEW"; // never auto-fix order execution
		default:
			return "MANUAL_REVIEW";
	}
}

// ── Feedback loop recording ───────────────────────────────────────────────────

interface FeedbackRecord {
	module: GuardedModule;
	operation: string;
	durationMs: number;
	success: boolean;
	errorMessage?: string;
	riskLevel?: RiskLevel;
	fallbackUsed?: boolean;
	input?: Record<string, unknown>;
}

async function recordFeedback(rec: FeedbackRecord): Promise<void> {
	try {
		await db.execute(sql`
      INSERT INTO self_healing_feedback
        (module, operation, duration_ms, success, error_message, risk_level, fallback_used, occurred_at)
      VALUES
        (${rec.module}, ${rec.operation}, ${rec.durationMs}, ${rec.success},
         ${rec.errorMessage ?? null}, ${rec.riskLevel ?? null}, ${rec.fallbackUsed ?? false}, NOW())
    `);
	} catch {
		// Best-effort — table may not exist yet; never throw from here
	}
}

// ── Feedback loop stats (for admin API) ──────────────────────────────────────

export async function getFeedbackStats(hours = 24): Promise<{
	byModule: Array<{
		module: string;
		totalCalls: number;
		failures: number;
		failureRate: string;
		fallbacksUsed: number;
		avgDurationMs: string;
		fixStrategy: string;
	}>;
	recentFailures: Array<{
		module: string;
		operation: string;
		errorMessage: string;
		occurredAt: string;
	}>;
	summary: {
		totalCalls: number;
		totalFailures: number;
		overallFailureRate: string;
		hoursWindow: number;
	};
}> {
	try {
		const byModuleResult = await db.execute(sql`
      SELECT
        module,
        COUNT(*)                                    AS total_calls,
        COUNT(*) FILTER (WHERE NOT success)         AS failures,
        COUNT(*) FILTER (WHERE fallback_used)       AS fallback_used,
        ROUND(AVG(duration_ms)::numeric, 1)         AS avg_duration_ms
      FROM self_healing_feedback
      WHERE occurred_at >= NOW() - INTERVAL '1 hour' * ${hours}
      GROUP BY module
      ORDER BY failures DESC
    `);

		const recentFailuresResult = await db.execute(sql`
      SELECT module, operation, error_message, occurred_at
      FROM self_healing_feedback
      WHERE NOT success
        AND occurred_at >= NOW() - INTERVAL '1 hour' * ${hours}
      ORDER BY occurred_at DESC
      LIMIT 50
    `);

		const summaryResult = await db.execute(sql`
      SELECT
        COUNT(*)                              AS total_calls,
        COUNT(*) FILTER (WHERE NOT success)   AS total_failures
      FROM self_healing_feedback
      WHERE occurred_at >= NOW() - INTERVAL '1 hour' * ${hours}
    `);

		const rows = byModuleResult.rows as any[];
		const failures = recentFailuresResult.rows as any[];
		const summary = summaryResult.rows[0] as any;

		const totalCalls = Number.parseInt(summary?.total_calls ?? "0", 10);
		const totalFailures = Number.parseInt(summary?.total_failures ?? "0", 10);

		return {
			byModule: rows.map((r) => ({
				module: r.module,
				totalCalls: Number.parseInt(r.total_calls, 10),
				failures: Number.parseInt(r.failures, 10),
				failureRate:
					totalCalls > 0
						? `${((Number.parseInt(r.failures, 10) / Number.parseInt(r.total_calls, 10)) * 100).toFixed(1)}%`
						: "0%",
				fallbacksUsed: Number.parseInt(r.fallback_used, 10),
				avgDurationMs: r.avg_duration_ms ?? "0",
				fixStrategy: routeFixStrategy(r.module as GuardedModule),
			})),
			recentFailures: failures.map((f) => ({
				module: f.module,
				operation: f.operation,
				errorMessage: f.error_message,
				occurredAt: f.occurred_at,
			})),
			summary: {
				totalCalls,
				totalFailures,
				overallFailureRate:
					totalCalls > 0
						? `${((totalFailures / totalCalls) * 100).toFixed(1)}%`
						: "0%",
				hoursWindow: hours,
			},
		};
	} catch {
		return {
			byModule: [],
			recentFailures: [],
			summary: {
				totalCalls: 0,
				totalFailures: 0,
				overallFailureRate: "0%",
				hoursWindow: hours,
			},
		};
	}
}
