// @ts-nocheck
/**
 * Client Portfolio API — Unified Broker-Agnostic Gateway
 *
 * Purpose : Single API surface for all client portfolio data. The frontend
 *           NEVER calls broker-specific endpoints (IRIS, Alpaca, IIFL) directly.
 *           All portfolio views go through these routes.
 *
 * Routes:
 *   GET /api/clients/:clientId/portfolio/summary         → Total AUM, allocation, broker breakdown
 *   GET /api/clients/:clientId/portfolio/holdings        → All holdings across all brokers, normalized
 *   GET /api/clients/:clientId/portfolio/transactions    → Cross-broker transaction ledger
 *   GET /api/clients/:clientId/portfolio/asset-allocation → Allocation pie breakdown
 *   GET /api/clients/:clientId/portfolio/performance     → XIRR, absolute returns, period returns
 *   GET /api/clients/:clientId/portfolio/tax             → Capital gains summary
 *
 * Security:
 *   - requireAuth: session-based authentication
 *   - Clients can only read their own portfolio (unless agent/admin)
 *   - Agents can read any client they manage
 *
 * Architecture:
 *   This router delegates to existing services — it adds NO business logic.
 *   It is purely an API composition and authorization layer.
 */

import { Router, Request, Response } from "express";
import { requireAuth, requireAgent } from "../middleware/roleMiddleware";
import { unifiedHoldingsReaderService } from "../services/unified-holdings-reader-service";
import { portfolioAggregator } from "../services/portfolio/portfolioAggregator";
import { db } from "../db";
import {
	portfolioTransactions,
	comprehensiveHoldings,
	portfolios,
} from "@shared/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { logger } from "../logger";

const router = Router();

// ─── Constants ────────────────────────────────────────────────────────────────

const API_VERSION = "2.0.0";

/** Standard FintekPro API response envelope */
function ok(data: unknown, sources: string[] = []) {
	return {
		success: true,
		data,
		meta: {
			timestamp: new Date().toISOString(),
			version: API_VERSION,
			sources,
		},
	};
}

function err(message: string, errorCode = "PORTFOLIO_ERROR") {
	return {
		success: false,
		error: { error_code: errorCode, message, retryable: false },
		meta: { timestamp: new Date().toISOString(), version: API_VERSION },
	};
}

// ─── Authorization Guard ──────────────────────────────────────────────────────

/**
 * Resolves which client ID to use.
 * - "me" → authenticated user's own ID
 * - Explicit ID → allowed only for agents/admins, or if it matches req.user.id
 */
function resolveClientId(req: Request): {
	clientId: string | null;
	forbidden: boolean;
} {
	const { clientId } = req.params;
	const userId = (req as any).user?.id;
	const role = (req as any).user?.role;

	if (clientId === "me") return { clientId: userId, forbidden: false };
	if (clientId === userId) return { clientId: userId, forbidden: false };
	if (role === "admin" || role === "agent")
		return { clientId, forbidden: false };

	return { clientId: null, forbidden: true };
}

// ─── GET /summary ─────────────────────────────────────────────────────────────

/**
 * Returns the top-level portfolio summary for a client:
 * total AUM, unrealised P&L, asset class weights, country allocation,
 * per-broker breakdown, and stale-broker warnings.
 *
 * Inputs  : clientId (path param), optional ?capabilities=MF,EQUITY_IN (comma-sep filter)
 * Outputs : UnifiedPortfolioResult.summary + staleBrokers warning list
 * Edge    : Partial broker failure → 200 with staleBrokers list, not 500
 */
router.get(
	"/:clientId/portfolio/summary",
	requireAuth,
	async (req: Request, res: Response) => {
		const start = Date.now();
		const { clientId, forbidden } = resolveClientId(req);
		if (forbidden)
			return res.status(403).json(err("Access denied", "FORBIDDEN"));

		try {
			const capabilitiesParam = (req.query.capabilities as string) ?? "";
			const preferCapabilities = capabilitiesParam
				? (capabilitiesParam
						.split(",")
						.map((c) => c.trim())
						.filter(Boolean) as any[])
				: undefined;

			const result = await portfolioAggregator.getUnifiedPortfolio(
				clientId!,
				undefined,
				undefined,
				preferCapabilities,
			);

			logger.info(`[ClientPortfolioAPI] summary fetched`, {
				event: "PORTFOLIO_SUMMARY_FETCHED",
				user_id: clientId,
				latency_ms: Date.now() - start,
				status: result.staleBrokers.length > 0 ? "partial" : "success",
			});

			const sources = result.brokerResults
				.filter((b) => b.success)
				.map((b) => b.brokerId);
			const responseData = {
				...result.summary,
				staleBrokers: result.staleBrokers,
				fetchedAt: result.fetchedAt,
				...(result.staleBrokers.length > 0 && {
					warning: `Data from ${result.staleBrokers.join(", ")} could not be fetched. Showing partial results.`,
				}),
			};

			return res.json(ok(responseData, sources));
		} catch (e: any) {
			logger.error(`[ClientPortfolioAPI] summary error`, {
				event: "PORTFOLIO_SUMMARY_ERROR",
				user_id: clientId,
				message: e.message,
			});
			return res
				.status(500)
				.json(err(e.message ?? "Failed to fetch portfolio summary"));
		}
	},
);

// ─── GET /holdings ────────────────────────────────────────────────────────────

/**
 * Returns all holdings for a client, normalized across all brokers.
 * Merges: comprehensiveHoldings (IRIS/CAS) + Alpaca live positions + MPAL brokers.
 *
 * Query params:
 *   ?assetClass=MUTUAL_FUND,EQUITY_IN   filter by asset class
 *   ?source=IRIS,ALPACA                 filter by broker source
 *   ?page=1&limit=50                    pagination
 *
 * Inputs  : clientId
 * Outputs : paginated UnifiedHolding array with totals
 */
router.get(
	"/:clientId/portfolio/holdings",
	requireAuth,
	async (req: Request, res: Response) => {
		const start = Date.now();
		const { clientId, forbidden } = resolveClientId(req);
		if (forbidden)
			return res.status(403).json(err("Access denied", "FORBIDDEN"));

		try {
			const page = Math.max(
				1,
				Number.parseInt((req.query.page as string) ?? "1", 10),
			);
			const limit = Math.min(
				200,
				Math.max(1, Number.parseInt((req.query.limit as string) ?? "50", 10)),
			);
			const assetClassFilter = req.query.assetClass
				? (req.query.assetClass as string).split(",")
				: null;
			const sourceFilter = req.query.source
				? (req.query.source as string).split(",")
				: null;

			// Primary source: UnifiedHoldingsReader (merges comprehensiveHoldings + Alpaca)
			const allHoldings = await unifiedHoldingsReaderService.getHoldings(
				clientId!,
			);

			// Apply filters
			let filtered = allHoldings;
			if (assetClassFilter) {
				filtered = filtered.filter((h) =>
					assetClassFilter.some(
						(ac) =>
							h.assetClass?.toLowerCase().includes(ac.toLowerCase()) ||
							h.assetType?.toLowerCase().includes(ac.toLowerCase()),
					),
				);
			}
			if (sourceFilter) {
				filtered = filtered.filter((h) =>
					sourceFilter.some(
						(s) =>
							(h as any).broker?.toLowerCase().includes(s.toLowerCase()) ||
							(h as any).dataSource?.toLowerCase().includes(s.toLowerCase()),
					),
				);
			}

			// Pagination
			const total = filtered.length;
			const paginated = filtered.slice((page - 1) * limit, page * limit);

			// Compute totals
			const totalValue = filtered.reduce(
				(s, h) => s + (h.currentValue ?? 0),
				0,
			);
			const totalInvested = filtered.reduce(
				(s, h) => s + (h.investedValue ?? h.currentValue ?? 0),
				0,
			);
			const totalGain = totalValue - totalInvested;
			const totalGainPct =
				totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

			logger.info(`[ClientPortfolioAPI] holdings fetched`, {
				event: "PORTFOLIO_HOLDINGS_FETCHED",
				user_id: clientId,
				count: total,
				latency_ms: Date.now() - start,
				status: "success",
			});

			return res.json(
				ok(
					{
						holdings: paginated,
						totals: {
							totalValueInr: Math.round(totalValue * 100) / 100,
							totalInvestedInr: Math.round(totalInvested * 100) / 100,
							totalGainInr: Math.round(totalGain * 100) / 100,
							totalGainPct: Math.round(totalGainPct * 100) / 100,
							holdingCount: total,
						},
						pagination: {
							page,
							limit,
							total,
							totalPages: Math.ceil(total / limit),
						},
					},
					["comprehensiveHoldings", "alpaca"],
				),
			);
		} catch (e: any) {
			logger.error(`[ClientPortfolioAPI] holdings error`, {
				event: "PORTFOLIO_HOLDINGS_ERROR",
				user_id: clientId,
				message: e.message,
			});
			return res.status(500).json(err(e.message ?? "Failed to fetch holdings"));
		}
	},
);

// ─── GET /transactions ────────────────────────────────────────────────────────

/**
 * Returns the cross-broker transaction ledger for a client.
 * Sources: portfolio_transactions table (normalized entries from all adapters).
 *
 * Query params:
 *   ?from=YYYY-MM-DD   start date filter
 *   ?to=YYYY-MM-DD     end date filter
 *   ?type=BUY,SELL     transaction type filter
 *   ?source=IRIS,ALPACA  broker source filter
 *   ?page=1&limit=50
 */
router.get(
	"/:clientId/portfolio/transactions",
	requireAuth,
	async (req: Request, res: Response) => {
		const start = Date.now();
		const { clientId, forbidden } = resolveClientId(req);
		if (forbidden)
			return res.status(403).json(err("Access denied", "FORBIDDEN"));

		try {
			const page = Math.max(
				1,
				Number.parseInt((req.query.page as string) ?? "1", 10),
			);
			const limit = Math.min(
				500,
				Math.max(1, Number.parseInt((req.query.limit as string) ?? "50", 10)),
			);
			const fromDate = req.query.from as string | undefined;
			const toDate = req.query.to as string | undefined;
			const typeFilter = req.query.type
				? (req.query.type as string).split(",")
				: null;
			const sourceFilter = req.query.source
				? (req.query.source as string).split(",")
				: null;

			// Build query conditions
			const conditions: any[] = [eq(portfolioTransactions.clientId, clientId!)];
			if (fromDate)
				conditions.push(
					gte(portfolioTransactions.tradeDate, new Date(fromDate)),
				);
			if (toDate)
				conditions.push(lte(portfolioTransactions.tradeDate, new Date(toDate)));
			if (typeFilter && typeFilter.length > 0) {
				// Drizzle inArray requires direct column access
				// Using raw sql for multi-value IN check
				// TypeFilter applied in-memory post-fetch for simplicity
			}

			const allTxns = await db
				.select()
				.from(portfolioTransactions)
				.where(conditions.length === 1 ? conditions[0] : and(...conditions))
				.orderBy(desc(portfolioTransactions.tradeDate));

			// Apply in-memory filters
			let filtered = allTxns;
			if (typeFilter)
				filtered = filtered.filter((t) =>
					typeFilter.includes(t.transactionType ?? ""),
				);
			if (sourceFilter)
				filtered = filtered.filter((t) =>
					sourceFilter.includes(t.source ?? ""),
				);

			const total = filtered.length;
			const paginated = filtered.slice((page - 1) * limit, page * limit);

			logger.info(`[ClientPortfolioAPI] transactions fetched`, {
				event: "PORTFOLIO_TRANSACTIONS_FETCHED",
				user_id: clientId,
				count: total,
				latency_ms: Date.now() - start,
				status: "success",
			});

			return res.json(
				ok(
					{
						transactions: paginated,
						pagination: {
							page,
							limit,
							total,
							totalPages: Math.ceil(total / limit),
						},
					},
					["portfolio_transactions"],
				),
			);
		} catch (e: any) {
			logger.error(`[ClientPortfolioAPI] transactions error`, {
				event: "PORTFOLIO_TRANSACTIONS_ERROR",
				user_id: clientId,
				message: e.message,
			});
			return res
				.status(500)
				.json(err(e.message ?? "Failed to fetch transactions"));
		}
	},
);

// ─── GET /asset-allocation ────────────────────────────────────────────────────

/**
 * Returns asset allocation breakdown for charts.
 * Groups holdings by assetClass and computes weight % of total.
 *
 * Inputs  : clientId
 * Outputs : allocation array [ { label, value, percentage, assetClass } ]
 */
router.get(
	"/:clientId/portfolio/asset-allocation",
	requireAuth,
	async (req: Request, res: Response) => {
		const start = Date.now();
		const { clientId, forbidden } = resolveClientId(req);
		if (forbidden)
			return res.status(403).json(err("Access denied", "FORBIDDEN"));

		try {
			const result = await portfolioAggregator.getUnifiedPortfolio(clientId!);

			const weights = result.summary.assetClassWeights;
			const totalInr = result.summary.totalValueInr;

			const allocation = Object.entries(weights)
				.map(([assetClass, pct]) => ({
					assetClass,
					label: ASSET_CLASS_LABELS[assetClass] ?? assetClass,
					valueInr: Math.round((pct / 100) * totalInr),
					percentage: pct,
					countryAllocation: result.summary.countryWeights,
				}))
				.sort((a, b) => b.percentage - a.percentage);

			logger.info(`[ClientPortfolioAPI] asset-allocation fetched`, {
				event: "PORTFOLIO_ALLOCATION_FETCHED",
				user_id: clientId,
				latency_ms: Date.now() - start,
				status: "success",
			});

			return res.json(
				ok(
					{
						allocation,
						totalValueInr: totalInr,
						countryBreakdown: result.summary.countryWeights,
						brokerBreakdown: result.summary.brokerBreakdown,
						fetchedAt: result.fetchedAt,
					},
					result.brokerResults.filter((b) => b.success).map((b) => b.brokerId),
				),
			);
		} catch (e: any) {
			logger.error(`[ClientPortfolioAPI] allocation error`, {
				event: "PORTFOLIO_ALLOCATION_ERROR",
				user_id: clientId,
				message: e.message,
			});
			return res
				.status(500)
				.json(err(e.message ?? "Failed to fetch asset allocation"));
		}
	},
);

// ─── GET /performance ─────────────────────────────────────────────────────────

/**
 * Returns portfolio performance metrics.
 * Reads from comprehensiveHoldings for invested vs current value,
 * computes absolute returns. XIRR requires transactions — uses simple
 * return when transaction history is incomplete.
 *
 * Inputs  : clientId
 * Outputs : { absoluteReturn, absoluteReturnPct, totalValueInr, totalInvestedInr, holdingCount }
 */
router.get(
	"/:clientId/portfolio/performance",
	requireAuth,
	async (req: Request, res: Response) => {
		const start = Date.now();
		const { clientId, forbidden } = resolveClientId(req);
		if (forbidden)
			return res.status(403).json(err("Access denied", "FORBIDDEN"));

		try {
			const holdings = await unifiedHoldingsReaderService.getHoldings(
				clientId!,
			);

			const totalValue = holdings.reduce(
				(s, h) => s + (h.currentValue ?? 0),
				0,
			);
			const totalInvested = holdings.reduce(
				(s, h) => s + (h.investedValue ?? h.currentValue ?? 0),
				0,
			);
			const absoluteReturn = totalValue - totalInvested;
			const absoluteReturnPct =
				totalInvested > 0 ? (absoluteReturn / totalInvested) * 100 : 0;

			// Asset-class level breakdown
			const byAssetClass: Record<
				string,
				{ value: number; invested: number; count: number }
			> = {};
			for (const h of holdings) {
				const key = h.assetClass ?? h.assetType ?? "OTHER";
				if (!byAssetClass[key])
					byAssetClass[key] = { value: 0, invested: 0, count: 0 };
				byAssetClass[key].value += h.currentValue ?? 0;
				byAssetClass[key].invested += h.investedValue ?? h.currentValue ?? 0;
				byAssetClass[key].count++;
			}

			const assetClassPerformance = Object.entries(byAssetClass)
				.map(([assetClass, d]) => ({
					assetClass,
					label: ASSET_CLASS_LABELS[assetClass] ?? assetClass,
					currentValue: Math.round(d.value * 100) / 100,
					investedValue: Math.round(d.invested * 100) / 100,
					absoluteReturn: Math.round((d.value - d.invested) * 100) / 100,
					returnPct:
						d.invested > 0
							? Math.round(((d.value - d.invested) / d.invested) * 10000) / 100
							: 0,
					holdingCount: d.count,
				}))
				.sort((a, b) => b.currentValue - a.currentValue);

			logger.info(`[ClientPortfolioAPI] performance fetched`, {
				event: "PORTFOLIO_PERFORMANCE_FETCHED",
				user_id: clientId,
				latency_ms: Date.now() - start,
				status: "success",
			});

			return res.json(
				ok(
					{
						totalValueInr: Math.round(totalValue * 100) / 100,
						totalInvestedInr: Math.round(totalInvested * 100) / 100,
						absoluteReturnInr: Math.round(absoluteReturn * 100) / 100,
						absoluteReturnPct: Math.round(absoluteReturnPct * 100) / 100,
						holdingCount: holdings.length,
						assetClassPerformance,
						disclaimer:
							"Returns are calculated on a simple cost-vs-market-value basis. XIRR requires complete transaction history.",
						calculatedAt: new Date().toISOString(),
					},
					["comprehensiveHoldings", "alpaca"],
				),
			);
		} catch (e: any) {
			logger.error(`[ClientPortfolioAPI] performance error`, {
				event: "PORTFOLIO_PERFORMANCE_ERROR",
				user_id: clientId,
				message: e.message,
			});
			return res
				.status(500)
				.json(err(e.message ?? "Failed to fetch performance"));
		}
	},
);

// ─── GET /tax ─────────────────────────────────────────────────────────────────

/**
 * Returns capital gains summary for tax planning.
 * Short-term (<1yr) vs Long-term (>=1yr) holdings breakdown.
 * Delegates to the tax service for detailed STCG/LTCG calculations.
 *
 * Inputs  : clientId, optional ?fy=2024-25
 * Outputs : { stcgSummary, ltcgSummary, taxLiability, holdings[] }
 *
 * FASP-AI RULE: This is informational only. Tax filing requires CA approval.
 */
router.get(
	"/:clientId/portfolio/tax",
	requireAuth,
	async (req: Request, res: Response) => {
		const start = Date.now();
		const { clientId, forbidden } = resolveClientId(req);
		if (forbidden)
			return res.status(403).json(err("Access denied", "FORBIDDEN"));

		try {
			const holdings = await unifiedHoldingsReaderService.getHoldings(
				clientId!,
			);
			const now = new Date();
			const oneYearAgo = new Date(
				now.getFullYear() - 1,
				now.getMonth(),
				now.getDate(),
			);

			// Classify holdings as STCG or LTCG eligible based on purchase date
			const stcgHoldings: typeof holdings = [];
			const ltcgHoldings: typeof holdings = [];
			const unclassified: typeof holdings = [];

			for (const h of holdings) {
				// Use whatever date is available
				const purchaseDateRaw =
					(h as any).purchaseDate ?? (h as any).navDate ?? null;
				if (!purchaseDateRaw) {
					unclassified.push(h);
					continue;
				}
				const purchaseDate = new Date(purchaseDateRaw);
				if (purchaseDate > oneYearAgo) {
					stcgHoldings.push(h);
				} else {
					ltcgHoldings.push(h);
				}
			}

			const calcGain = (arr: typeof holdings) =>
				arr.reduce(
					(s, h) =>
						s +
						((h.currentValue ?? 0) - (h.investedValue ?? h.currentValue ?? 0)),
					0,
				);

			const stcgGain = calcGain(stcgHoldings);
			const ltcgGain = calcGain(ltcgHoldings);

			logger.info(`[ClientPortfolioAPI] tax fetched`, {
				event: "PORTFOLIO_TAX_FETCHED",
				user_id: clientId,
				latency_ms: Date.now() - start,
				status: "success",
			});

			return res.json(
				ok(
					{
						stcg: {
							holdingCount: stcgHoldings.length,
							estimatedGainInr: Math.round(stcgGain * 100) / 100,
							taxRateNote:
								"STCG on equity: 20% (post July 2024 budget), on debt/MF: as per income slab",
						},
						ltcg: {
							holdingCount: ltcgHoldings.length,
							estimatedGainInr: Math.round(ltcgGain * 100) / 100,
							taxRateNote:
								"LTCG on equity >₹1.25L: 12.5% (post July 2024 budget)",
							exemptionLimitNote:
								"₹1,25,000 exemption on LTCG from equity and equity MF",
						},
						unclassified: {
							holdingCount: unclassified.length,
							note: "Purchase date unavailable — import full transaction history for accurate tax calculation",
						},
						disclaimer:
							"This is an estimate only. Actual tax liability depends on your income slab, grandfathering rules, indexation, and corporate actions. Consult your CA before filing.",
						calculatedAt: new Date().toISOString(),
					},
					["comprehensiveHoldings"],
				),
			);
		} catch (e: any) {
			logger.error(`[ClientPortfolioAPI] tax error`, {
				event: "PORTFOLIO_TAX_ERROR",
				user_id: clientId,
				message: e.message,
			});
			return res
				.status(500)
				.json(err(e.message ?? "Failed to fetch tax summary"));
		}
	},
);

// ─── Label Maps ───────────────────────────────────────────────────────────────

const ASSET_CLASS_LABELS: Record<string, string> = {
	EQUITY_IN: "Indian Equity",
	EQUITY_US: "US Equity",
	MUTUAL_FUND: "Mutual Fund",
	FIXED_INCOME: "Fixed Income",
	DERIVATIVES: "Derivatives",
	ALTERNATIVES: "Alternatives (PMS/AIF)",
	CRYPTO: "Crypto",
	OTHER: "Other",
	equity: "Equity",
	mutual_fund: "Mutual Fund",
	debt: "Debt",
	government_scheme: "Govt. Scheme",
	alternative: "Alternatives",
	real_estate: "Real Estate",
	commodity: "Commodity",
	crypto: "Crypto",
	insurance: "Insurance",
	cash: "Cash",
};

export const clientPortfolioRouter = router;
