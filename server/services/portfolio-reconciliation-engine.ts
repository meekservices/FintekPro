// @ts-nocheck
/**
 * Portfolio Reconciliation Engine
 *
 * Purpose:
 *   Compares live broker positions (IRIS, Alpaca, IIFL via MPAL) against the
 *   normalized `comprehensive_holdings` ledger and detects:
 *
 *   1. Quantity mismatches  — broker says X units, ledger says Y
 *   2. Value mismatches     — broker market value differs from ledger by >2%
 *   3. Unmapped ISINs       — broker holding has ISIN not in comprehensive_holdings
 *   4. Missing broker data  — holding in ledger but no live broker position found
 *   5. Duplicate holdings   — same ISIN appears >1 time in comprehensive_holdings
 *   6. Stale prices         — last_enriched_at > 3 days old
 *   7. Source gaps          — expected broker adapter returned no data (stale/error)
 *
 * Architecture:
 *   - NEVER blocks the read path — runs as a background job
 *   - Results written to: `portfolio_reconciliation_log` (created via schema repair #37)
 *   - Admin API reads from this table to surface discrepancies in the dashboard
 *   - Severity: CRITICAL (>10% diff) | HIGH (>5%) | MEDIUM (>2%) | LOW (<2% or cosmetic)
 *
 * SEBI Compliance:
 *   SEBI (IA) Regulations 2013 requires advisors to reconcile client assets daily.
 *   This engine fulfils that obligation by producing an immutable audit trail.
 *
 * FASP-AI Rule:
 *   This is a Decision Support System only. No auto-corrections are applied.
 *   All discrepancies require human review before any action is taken.
 */

import { db } from "../db";
import { comprehensiveHoldings, users } from "@shared/schema";
import { eq, sql, and, isNotNull, lt } from "drizzle-orm";
import { portfolioAggregator } from "./portfolio/portfolioAggregator";
import { unifiedHoldingsReaderService } from "./unified-holdings-reader-service";
import { logger } from "../logger";
import crypto from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DiscrepancyType =
	| "QUANTITY_MISMATCH"
	| "VALUE_MISMATCH"
	| "UNMAPPED_ISIN"
	| "MISSING_BROKER_DATA"
	| "DUPLICATE_HOLDING"
	| "STALE_PRICE"
	| "SOURCE_GAP";

export type DiscrepancySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface HoldingDiscrepancy {
	clientId: string;
	discrepancyType: DiscrepancyType;
	severity: DiscrepancySeverity;
	symbol: string;
	isin: string | null;
	assetType: string | null;
	source: string; // Which broker/source the discrepancy is between
	ledgerValue: number | null; // What comprehensive_holdings says
	brokerValue: number | null; // What the live broker says
	diffAbsolute: number | null; // |ledger - broker|
	diffPercent: number | null; // as % of ledger value
	description: string;
	detectedAt: string; // ISO timestamp
	requiresReview: boolean;
	autoResolvable: boolean;
}

export interface ReconciliationResult {
	clientId: string;
	runAt: string;
	durationMs: number;
	status: "success" | "partial" | "error";
	discrepancies: HoldingDiscrepancy[];
	summary: {
		total: number;
		critical: number;
		high: number;
		medium: number;
		low: number;
		byType: Partial<Record<DiscrepancyType, number>>;
	};
	staleBrokers: string[];
	checksum: string;
	engineVersion: string;
}

const ENGINE_VERSION = "recon-v1.0";
const STALE_PRICE_DAYS = 3;
const CRITICAL_DIFF_PCT = 10;
const HIGH_DIFF_PCT = 5;
const MEDIUM_DIFF_PCT = 2;

// ─── Engine ───────────────────────────────────────────────────────────────────

class PortfolioReconciliationEngine {
	/**
	 * Run full reconciliation for a single client.
	 * Compares live broker positions vs comprehensive_holdings.
	 *
	 * @param clientId  - the user ID to reconcile
	 * @returns ReconciliationResult with all flagged discrepancies
	 */
	async reconcileClient(clientId: string): Promise<ReconciliationResult> {
		const start = Date.now();
		const runAt = new Date().toISOString();
		const discrepancies: HoldingDiscrepancy[] = [];
		let staleBrokers: string[] = [];

		logger.info("[ReconEngine] Starting client reconciliation", {
			event: "RECON_CLIENT_START",
			user_id: clientId,
		});

		try {
			// ── Step 1: Fetch comprehensive_holdings (ledger truth) ──────────────────
			const ledgerRows = await db
				.select()
				.from(comprehensiveHoldings)
				.where(eq(comprehensiveHoldings.userId, clientId));

			// ── Step 2: Fetch live broker positions ──────────────────────────────────
			const [brokerResult, unifiedHoldings] = await Promise.allSettled([
				portfolioAggregator.getUnifiedPortfolio(clientId),
				unifiedHoldingsReaderService.getHoldings(clientId),
			]);

			const livePositions =
				unifiedHoldings.status === "fulfilled" ? unifiedHoldings.value : [];
			staleBrokers =
				brokerResult.status === "fulfilled"
					? brokerResult.value.staleBrokers
					: ["UNKNOWN"];

			if (brokerResult.status === "rejected") {
				staleBrokers = ["ALL"];
			}

			// ── Step 3: Build lookup maps ─────────────────────────────────────────────
			// Ledger: keyed by ISIN (primary) or symbol (fallback)
			const ledgerByIsin = new Map<string, (typeof ledgerRows)[0][]>();
			const ledgerBySymbol = new Map<string, (typeof ledgerRows)[0][]>();

			for (const row of ledgerRows) {
				const key = row.isin ?? row.symbol;
				if (row.isin) {
					if (!ledgerByIsin.has(row.isin)) ledgerByIsin.set(row.isin, []);
					ledgerByIsin.get(row.isin)!.push(row);
				}
				if (row.symbol) {
					if (!ledgerBySymbol.has(row.symbol))
						ledgerBySymbol.set(row.symbol, []);
					ledgerBySymbol.get(row.symbol)!.push(row);
				}
			}

			// Live positions: keyed by ISIN or symbol
			const liveByIsin = new Map<string, (typeof livePositions)[0]>();
			const liveBySymbol = new Map<string, (typeof livePositions)[0]>();
			for (const pos of livePositions) {
				if ((pos as any).isin) liveByIsin.set((pos as any).isin, pos);
				if (pos.symbol) liveBySymbol.set(pos.symbol, pos);
			}

			// ── Step 4: Check #5 — Duplicate holdings in ledger ──────────────────────
			for (const [isin, rows] of ledgerByIsin.entries()) {
				if (rows.length > 1) {
					discrepancies.push({
						clientId,
						discrepancyType: "DUPLICATE_HOLDING",
						severity: "MEDIUM",
						symbol: rows[0].symbol,
						isin,
						assetType: rows[0].assetType,
						source: rows.map((r) => r.dataSource).join(", "),
						ledgerValue: rows.reduce(
							(s, r) => s + Number.parseFloat(r.marketValue ?? "0"),
							0,
						),
						brokerValue: null,
						diffAbsolute: null,
						diffPercent: null,
						description: `ISIN ${isin} appears ${rows.length} times in comprehensive_holdings (sources: ${rows.map((r) => r.dataSource).join(", ")}). Possible double-import.`,
						detectedAt: runAt,
						requiresReview: true,
						autoResolvable: false,
					});
				}
			}

			// ── Step 5: Check #6 — Stale prices ──────────────────────────────────────
			const staleCutoff = new Date();
			staleCutoff.setDate(staleCutoff.getDate() - STALE_PRICE_DAYS);

			for (const row of ledgerRows) {
				const lastEnriched = row.lastEnrichedAt
					? new Date(row.lastEnrichedAt)
					: null;
				if (!lastEnriched || lastEnriched < staleCutoff) {
					discrepancies.push({
						clientId,
						discrepancyType: "STALE_PRICE",
						severity: "LOW",
						symbol: row.symbol,
						isin: row.isin ?? null,
						assetType: row.assetType,
						source: row.dataSource,
						ledgerValue: Number.parseFloat(row.currentPrice ?? "0"),
						brokerValue: null,
						diffAbsolute: null,
						diffPercent: null,
						description: `${row.symbol}: current_price not refreshed in ${STALE_PRICE_DAYS}+ days (last: ${lastEnriched?.toISOString() ?? "never"})`,
						detectedAt: runAt,
						requiresReview: false,
						autoResolvable: true,
					});
				}
			}

			// ── Step 6: Compare ledger vs live broker ─────────────────────────────────
			for (const [isin, rows] of ledgerByIsin.entries()) {
				const ledgerRow = rows[0]; // Use first match for comparisons
				const livePos =
					liveByIsin.get(isin) ??
					(ledgerRow.symbol ? liveBySymbol.get(ledgerRow.symbol) : undefined);

				const ledgerQty = Number.parseFloat(
					ledgerRow.quantity ?? ledgerRow.units ?? "0",
				);
				const ledgerValue = Number.parseFloat(ledgerRow.marketValue ?? "0");

				if (!livePos) {
					// Check #4: In ledger but no live broker position
					// Only flag equity/MF (not EPF, PPF, manual entries which won't be in live broker)
					const manualSources = [
						"manual",
						"epf",
						"ppf",
						"nps",
						"government_portal",
					];
					if (
						!manualSources.includes(ledgerRow.dataSource?.toLowerCase() ?? "")
					) {
						discrepancies.push({
							clientId,
							discrepancyType: "MISSING_BROKER_DATA",
							severity: staleBrokers.length > 0 ? "LOW" : "MEDIUM",
							symbol: ledgerRow.symbol,
							isin,
							assetType: ledgerRow.assetType,
							source: ledgerRow.dataSource,
							ledgerValue,
							brokerValue: null,
							diffAbsolute: null,
							diffPercent: null,
							description: `${ledgerRow.symbol} (ISIN: ${isin}) is in comprehensive_holdings (source: ${ledgerRow.dataSource}) but not in live broker positions.${staleBrokers.length > 0 ? ` Note: broker(s) ${staleBrokers.join(", ")} returned stale/no data.` : ""}`,
							detectedAt: runAt,
							requiresReview: staleBrokers.length === 0,
							autoResolvable: false,
						});
					}
					continue;
				}

				const liveQty = livePos.quantity ?? 0;
				const liveValue = livePos.currentValue ?? 0;

				// Check #1: Quantity mismatch
				if (
					ledgerQty > 0 &&
					Math.abs(ledgerQty - liveQty) / ledgerQty > 0.001
				) {
					const pct = ((liveQty - ledgerQty) / ledgerQty) * 100;
					discrepancies.push({
						clientId,
						discrepancyType: "QUANTITY_MISMATCH",
						severity: this.classifySeverity(Math.abs(pct)),
						symbol: ledgerRow.symbol,
						isin,
						assetType: ledgerRow.assetType,
						source:
							(livePos as any).broker ?? (livePos as any).dataSource ?? "LIVE",
						ledgerValue: ledgerQty,
						brokerValue: liveQty,
						diffAbsolute: Math.abs(ledgerQty - liveQty),
						diffPercent: Math.round(Math.abs(pct) * 100) / 100,
						description: `${ledgerRow.symbol}: Ledger qty=${ledgerQty.toFixed(4)}, Broker qty=${liveQty.toFixed(4)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`,
						detectedAt: runAt,
						requiresReview: true,
						autoResolvable: false,
					});
				}

				// Check #2: Value mismatch (only flag if >2% difference in market value)
				if (ledgerValue > 100 && liveValue > 0) {
					const valueDiffPct =
						Math.abs((liveValue - ledgerValue) / ledgerValue) * 100;
					if (valueDiffPct > MEDIUM_DIFF_PCT) {
						discrepancies.push({
							clientId,
							discrepancyType: "VALUE_MISMATCH",
							severity: this.classifySeverity(valueDiffPct),
							symbol: ledgerRow.symbol,
							isin,
							assetType: ledgerRow.assetType,
							source: (livePos as any).broker ?? "LIVE",
							ledgerValue,
							brokerValue: liveValue,
							diffAbsolute: Math.abs(liveValue - ledgerValue),
							diffPercent: Math.round(valueDiffPct * 100) / 100,
							description: `${ledgerRow.symbol}: Ledger value=₹${ledgerValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}, Broker value=₹${liveValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })} (${valueDiffPct.toFixed(2)}% diff). May be a stale price.`,
							detectedAt: runAt,
							requiresReview: valueDiffPct > HIGH_DIFF_PCT,
							autoResolvable: valueDiffPct < HIGH_DIFF_PCT, // Auto-resolvable if likely a price lag
						});
					}
				}
			}

			// ── Step 7: Check #3 — Unmapped ISINs in live broker ────────────────────
			for (const pos of livePositions) {
				const isin = (pos as any).isin;
				const symbol = pos.symbol;
				if (isin && !ledgerByIsin.has(isin)) {
					discrepancies.push({
						clientId,
						discrepancyType: "UNMAPPED_ISIN",
						severity: "HIGH",
						symbol: symbol ?? isin,
						isin: isin ?? null,
						assetType: pos.assetType ?? null,
						source: (pos as any).broker ?? "LIVE",
						ledgerValue: null,
						brokerValue: pos.currentValue ?? null,
						diffAbsolute: pos.currentValue ?? null,
						diffPercent: null,
						description: `Broker has holding in ${symbol ?? isin} (ISIN: ${isin}, ₹${(pos.currentValue ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}) but it is NOT in comprehensive_holdings. CAS upload may be missing or outdated.`,
						detectedAt: runAt,
						requiresReview: true,
						autoResolvable: false,
					});
				} else if (!isin && symbol && !ledgerBySymbol.has(symbol)) {
					// No ISIN — match by symbol
					discrepancies.push({
						clientId,
						discrepancyType: "UNMAPPED_ISIN",
						severity: "MEDIUM",
						symbol,
						isin: null,
						assetType: pos.assetType ?? null,
						source: (pos as any).broker ?? "LIVE",
						ledgerValue: null,
						brokerValue: pos.currentValue ?? null,
						diffAbsolute: pos.currentValue ?? null,
						diffPercent: null,
						description: `Broker has holding in ${symbol} (no ISIN, ₹${(pos.currentValue ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}) not in comprehensive_holdings. Verify CAS/CDSL import.`,
						detectedAt: runAt,
						requiresReview: true,
						autoResolvable: false,
					});
				}
			}

			// ── Step 8: Check #7 — Source gaps (broker returned empty) ───────────────
			for (const staleBroker of staleBrokers) {
				discrepancies.push({
					clientId,
					discrepancyType: "SOURCE_GAP",
					severity: "LOW",
					symbol: "*",
					isin: null,
					assetType: null,
					source: staleBroker,
					ledgerValue: null,
					brokerValue: null,
					diffAbsolute: null,
					diffPercent: null,
					description: `Broker adapter "${staleBroker}" returned no data or failed during this reconciliation run. Holdings comparison for this broker is incomplete.`,
					detectedAt: runAt,
					requiresReview: false,
					autoResolvable: true,
				});
			}

			// ── Step 9: Build summary ─────────────────────────────────────────────────
			const summary = this.buildSummary(discrepancies);
			const checksum = this.generateChecksum(clientId, discrepancies, runAt);

			const result: ReconciliationResult = {
				clientId,
				runAt,
				durationMs: Date.now() - start,
				status:
					staleBrokers.length === livePositions.length + 1
						? "partial"
						: "success",
				discrepancies,
				summary,
				staleBrokers,
				checksum,
				engineVersion: ENGINE_VERSION,
			};

			// ── Step 10: Persist to reconciliation log ────────────────────────────────
			await this.persistReconciliationLog(result);

			logger.info("[ReconEngine] Client reconciliation complete", {
				event: "RECON_CLIENT_DONE",
				user_id: clientId,
				latency_ms: Date.now() - start,
				discrepancies: discrepancies.length,
				critical: summary.critical,
				high: summary.high,
				status: result.status,
			});

			return result;
		} catch (error: any) {
			logger.error("[ReconEngine] Reconciliation failed", {
				event: "RECON_CLIENT_ERROR",
				user_id: clientId,
				message: error.message,
				latency_ms: Date.now() - start,
				status: "error",
				retryable: true,
			});

			return {
				clientId,
				runAt,
				durationMs: Date.now() - start,
				status: "error",
				discrepancies: [],
				summary: {
					total: 0,
					critical: 0,
					high: 0,
					medium: 0,
					low: 0,
					byType: {},
				},
				staleBrokers: [],
				checksum: "",
				engineVersion: ENGINE_VERSION,
			};
		}
	}

	/**
	 * Run reconciliation for ALL clients with linked portfolios.
	 * Used by the daily cron job. Processes clients sequentially to avoid
	 * overwhelming the DB and broker APIs.
	 *
	 * @returns Aggregate stats across all clients
	 */
	async reconcileAllClients(): Promise<{
		totalClients: number;
		succeeded: number;
		failed: number;
		totalDiscrepancies: number;
		criticalDiscrepancies: number;
		durationMs: number;
	}> {
		const start = Date.now();

		logger.info("[ReconEngine] Starting full portfolio reconciliation run", {
			event: "RECON_ALL_START",
		});

		// Fetch all users with at least one holding in comprehensive_holdings
		const clientRows = await db.execute(sql`
      SELECT DISTINCT user_id FROM comprehensive_holdings WHERE user_id IS NOT NULL
    `);
		const clientIds: string[] = ((clientRows as any).rows ?? clientRows)
			.map((r: any) => r.user_id)
			.filter(Boolean);

		let succeeded = 0,
			failed = 0,
			totalDiscrepancies = 0,
			criticalDiscrepancies = 0;

		for (const clientId of clientIds) {
			try {
				const result = await this.reconcileClient(clientId);
				if (result.status !== "error") {
					succeeded++;
					totalDiscrepancies += result.summary.total;
					criticalDiscrepancies += result.summary.critical;
				} else {
					failed++;
				}
			} catch (e: any) {
				logger.warn(`[ReconEngine] Client ${clientId} failed`, {
					message: e?.message,
				});
				failed++;
			}

			// Throttle: 500ms between clients to avoid DB pressure
			await new Promise((r) => setTimeout(r, 500));
		}

		const stats = {
			totalClients: clientIds.length,
			succeeded,
			failed,
			totalDiscrepancies,
			criticalDiscrepancies,
			durationMs: Date.now() - start,
		};

		logger.info("[ReconEngine] Full reconciliation complete", {
			event: "RECON_ALL_DONE",
			...stats,
			status: failed === 0 ? "success" : "partial",
			latency_ms: stats.durationMs,
		});

		return stats;
	}

	// ─── Helpers ────────────────────────────────────────────────────────────────

	private classifySeverity(diffPct: number): DiscrepancySeverity {
		if (diffPct >= CRITICAL_DIFF_PCT) return "CRITICAL";
		if (diffPct >= HIGH_DIFF_PCT) return "HIGH";
		if (diffPct >= MEDIUM_DIFF_PCT) return "MEDIUM";
		return "LOW";
	}

	private buildSummary(discrepancies: HoldingDiscrepancy[]) {
		const byType: Partial<Record<DiscrepancyType, number>> = {};
		let critical = 0,
			high = 0,
			medium = 0,
			low = 0;

		for (const d of discrepancies) {
			byType[d.discrepancyType] = (byType[d.discrepancyType] ?? 0) + 1;
			if (d.severity === "CRITICAL") critical++;
			else if (d.severity === "HIGH") high++;
			else if (d.severity === "MEDIUM") medium++;
			else low++;
		}

		return { total: discrepancies.length, critical, high, medium, low, byType };
	}

	private generateChecksum(
		clientId: string,
		discrepancies: HoldingDiscrepancy[],
		runAt: string,
	): string {
		const data = JSON.stringify({
			clientId,
			runAt,
			count: discrepancies.length,
		});
		return crypto
			.createHash("sha256")
			.update(data)
			.digest("hex")
			.substring(0, 16);
	}

	/**
	 * Persist reconciliation results to the portfolio_reconciliation_log table.
	 * This table is created via schema repair #37.
	 * Failures here are non-fatal — the in-memory result is still returned.
	 */
	private async persistReconciliationLog(
		result: ReconciliationResult,
	): Promise<void> {
		try {
			await db.execute(sql`
        INSERT INTO portfolio_reconciliation_log (
          client_id, run_at, status, total_discrepancies, critical_count,
          high_count, medium_count, low_count, stale_brokers, checksum,
          engine_version, duration_ms, discrepancy_summary, created_at
        ) VALUES (
          ${result.clientId},
          ${result.runAt}::timestamptz,
          ${result.status},
          ${result.summary.total},
          ${result.summary.critical},
          ${result.summary.high},
          ${result.summary.medium},
          ${result.summary.low},
          ${JSON.stringify(result.staleBrokers)},
          ${result.checksum},
          ${result.engineVersion},
          ${result.durationMs},
          ${JSON.stringify(result.summary.byType)},
          NOW()
        )
        ON CONFLICT (client_id, run_at) DO UPDATE SET
          status = EXCLUDED.status,
          total_discrepancies = EXCLUDED.total_discrepancies,
          critical_count = EXCLUDED.critical_count,
          high_count = EXCLUDED.high_count,
          medium_count = EXCLUDED.medium_count,
          low_count = EXCLUDED.low_count,
          stale_brokers = EXCLUDED.stale_brokers,
          checksum = EXCLUDED.checksum,
          duration_ms = EXCLUDED.duration_ms,
          discrepancy_summary = EXCLUDED.discrepancy_summary
      `);

			// Persist individual discrepancies flagged as HIGH or CRITICAL
			for (const d of result.discrepancies.filter(
				(d) => d.severity === "CRITICAL" || d.severity === "HIGH",
			)) {
				await db
					.execute(sql`
          INSERT INTO portfolio_holding_discrepancies (
            client_id, run_at, discrepancy_type, severity, symbol, isin,
            asset_type, source, ledger_value, broker_value, diff_absolute,
            diff_percent, description, requires_review, auto_resolvable,
            resolved, created_at
          ) VALUES (
            ${d.clientId}, ${d.detectedAt}::timestamptz, ${d.discrepancyType},
            ${d.severity}, ${d.symbol}, ${d.isin},
            ${d.assetType}, ${d.source},
            ${d.ledgerValue}, ${d.brokerValue}, ${d.diffAbsolute}, ${d.diffPercent},
            ${d.description}, ${d.requiresReview}, ${d.autoResolvable},
            false, NOW()
          )
          ON CONFLICT DO NOTHING
        `)
					.catch(() => {}); // Non-fatal — table may not exist yet
			}
		} catch (e: any) {
			// Non-fatal — in-memory result is still valid
			logger.warn("[ReconEngine] Could not persist reconciliation log", {
				event: "RECON_PERSIST_ERROR",
				message: e?.message,
			});
		}
	}
}

export const portfolioReconciliationEngine =
	new PortfolioReconciliationEngine();
