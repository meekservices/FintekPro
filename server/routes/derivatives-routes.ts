import { Router, Request, Response } from "express";
import {
	derivativesService,
	SEBI_FNO_FRAMEWORK_2026,
	validateWeeklyExpiryEligibility,
} from "../services/derivatives-service";
import { longShortAlgoEngine } from "../services/derivatives/long-short-algo-engine";
import { upstoxMarketDataService } from "../services/upstox-market-data-service";
import { db } from "../db";
import { derivativeContracts, derivativePositions } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { logger } from "../logger";
import { requireAuth } from "../middleware/auth";
import { riskEngine } from "../services/compliance/riskEngine";

// Interface for StrategyLeg imported from service or redefined here if needed
interface StrategyLeg {
	type: "call" | "put" | "stock" | "future";
	action: "buy" | "sell";
	strikePrice?: number;
	quantity: number;
	premium?: number;
	expiryDate?: string;
}

const router = Router();

function errorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}

// ── Indian (NSE) derivatives ──────────────────────────────────────────────────

router.get("/symbols", async (_req: Request, res: Response): Promise<void> => {
	try {
		const data = await derivativesService.getAvailableSymbols();
		res.json(data);
	} catch (error: unknown) {
		logger.error("[Derivatives] Error fetching symbols:", errorMessage(error));
		res.status(500).json({ error: "Failed to fetch symbols" });
	}
});

router.get(
	"/expiry/:symbol",
	async (req: Request<{ symbol: string }>, res: Response): Promise<void> => {
		try {
			const { symbol } = req.params;
			const expiries = await derivativesService.getExpiryDates(
				symbol.toUpperCase(),
			);
			res.json({ symbol: symbol.toUpperCase(), expiryDates: expiries });
		} catch (error: unknown) {
			logger.error(
				"[Derivatives] Error fetching expiry dates:",
				errorMessage(error),
			);
			res.status(500).json({ error: "Failed to fetch expiry dates" });
		}
	},
);

router.get(
	"/options-chain/:symbol",
	async (
		req: Request<{ symbol: string }, any, any, { expiry?: string }>,
		res: Response,
	): Promise<void> => {
		try {
			const { symbol } = req.params;
			const { expiry } = req.query;
			const chain = await derivativesService.getOptionsChain(
				symbol.toUpperCase(),
				expiry,
			);
			res.json(chain);
		} catch (error: unknown) {
			logger.error(
				"[Derivatives] Error fetching options chain:",
				errorMessage(error),
			);
			res.status(500).json({ error: "Failed to fetch options chain" });
		}
	},
);

router.get(
	"/futures/:symbol",
	async (req: Request<{ symbol: string }>, res: Response): Promise<void> => {
		try {
			const { symbol } = req.params;
			const futures = await derivativesService.getFuturesData(
				symbol.toUpperCase(),
			);
			res.json({ symbol: symbol.toUpperCase(), futures });
		} catch (error: unknown) {
			logger.error(
				"[Derivatives] Error fetching futures data:",
				errorMessage(error),
			);
			res.status(500).json({ error: "Failed to fetch futures data" });
		}
	},
);

/**
 * GET /api/derivatives/nse/spot/:symbol
 * Real-time NSE spot price — Python/yfinance Tier, then hardcoded reference.
 * Works for indices (NIFTY, BANKNIFTY) and equities (RELIANCE, TCS …).
 */
router.get(
	"/nse/spot/:symbol",
	async (req: Request<{ symbol: string }>, res: Response): Promise<void> => {
		try {
			const symbol = req.params.symbol.toUpperCase();
			const price = await derivativesService.getSpotPrice(symbol);
			res.json({ symbol, price, timestamp: new Date().toISOString() });
		} catch (error: unknown) {
			logger.error(
				"[Derivatives] Error fetching NSE spot price:",
				errorMessage(error),
			);
			res.status(500).json({ error: "Failed to fetch spot price" });
		}
	},
);

/**
 * GET /api/derivatives/nse/oi-analysis/:symbol
 * Open Interest analysis: max-pain strike, PCR, top OI call/put strikes.
 * Data source: NSE option chain → synthetic fallback.
 */
router.get(
	"/nse/oi-analysis/:symbol",
	async (req: Request<{ symbol: string }>, res: Response): Promise<void> => {
		try {
			const symbol = req.params.symbol.toUpperCase();
			const analysis = await derivativesService.getOIAnalysis(symbol);
			res.json(analysis);
		} catch (error: unknown) {
			logger.error(
				"[Derivatives] Error computing OI analysis:",
				errorMessage(error),
			);
			res.status(500).json({ error: "Failed to compute OI analysis" });
		}
	},
);

// ── Global derivatives ────────────────────────────────────────────────────────

/**
 * GET /api/derivatives/global/futures
 * ~30 global futures quotes across equity indices, commodities, bonds,
 * FX, and agricultural markets.
 * Source tier: FMP → Python/yfinance.
 */
router.get(
	"/global/futures",
	async (_req: Request, res: Response): Promise<void> => {
		try {
			const data = await derivativesService.getGlobalFutures();
			res.json(data);
		} catch (error: unknown) {
			logger.error(
				"[Derivatives] Error fetching global futures:",
				errorMessage(error),
			);
			res.status(500).json({ error: "Failed to fetch global futures" });
		}
	},
);

// ── Analytics ─────────────────────────────────────────────────────────────────

router.post(
	"/greeks",
	async (
		req: Request<
			any,
			any,
			{
				spotPrice?: number;
				strikePrice?: number;
				daysToExpiry?: number;
				volatility?: number;
				riskFreeRate?: number;
				optionType?: "call" | "put";
			}
		>,
		res: Response,
	): Promise<void> => {
		try {
			const {
				spotPrice,
				strikePrice,
				daysToExpiry,
				volatility,
				riskFreeRate,
				optionType,
			} = req.body;

			if (
				spotPrice === undefined ||
				strikePrice === undefined ||
				daysToExpiry === undefined ||
				volatility === undefined
			) {
				res.status(400).json({ error: "Missing required parameters" });
				return;
			}
			const greeks = derivativesService.calculateGreeks(
				spotPrice,
				strikePrice,
				daysToExpiry,
				volatility / 100,
				riskFreeRate || 0.065,
				optionType || "call",
			);
			res.json(greeks);
		} catch (error: unknown) {
			logger.error(
				"[Derivatives] Error calculating Greeks:",
				errorMessage(error),
			);
			res.status(500).json({ error: "Failed to calculate Greeks" });
		}
	},
);

router.post(
	"/strategy-payoff",
	async (
		req: Request<
			any,
			any,
			{
				legs?: StrategyLeg[];
				spotPrice?: number;
				priceRange?: number | { min: number; max: number };
			}
		>,
		res: Response,
	): Promise<void> => {
		try {
			const { legs, spotPrice, priceRange } = req.body;
			if (!legs || !spotPrice) {
				res.status(400).json({ error: "Missing required parameters" });
				return;
			}

			// Convert numeric priceRange (%) to object format if necessary
			const range =
				typeof priceRange === "number"
					? {
							min: spotPrice * (1 - priceRange / 100),
							max: spotPrice * (1 + priceRange / 100),
						}
					: priceRange;

			const payoff = derivativesService.calculateStrategyPayoff(
				legs,
				spotPrice,
				range,
			);
			res.json(payoff);
		} catch (error: unknown) {
			logger.error(
				"[Derivatives] Error calculating strategy payoff:",
				errorMessage(error),
			);
			res.status(500).json({ error: "Failed to calculate strategy payoff" });
		}
	},
);

router.post(
	"/margin",
	async (
		req: Request<
			any,
			any,
			{
				symbol?: string;
				legs?: StrategyLeg[];
			}
		>,
		res: Response,
	): Promise<void> => {
		try {
			const { symbol, legs } = req.body;
			if (!symbol || !legs) {
				res.status(400).json({ error: "Missing required parameters" });
				return;
			}
			const margin = derivativesService.getMarginRequirement(
				symbol.toUpperCase(),
				legs,
			);
			res.json(margin);
		} catch (error: unknown) {
			logger.error(
				"[Derivatives] Error calculating margin:",
				errorMessage(error),
			);
			res.status(500).json({ error: "Failed to calculate margin" });
		}
	},
);

router.get(
	"/strategies",
	async (_req: Request, res: Response): Promise<void> => {
		try {
			const strategies = derivativesService.getPopularStrategies();
			res.json({ strategies });
		} catch (error: unknown) {
			logger.error(
				"[Derivatives] Error fetching strategies:",
				errorMessage(error),
			);
			res.status(500).json({ error: "Failed to fetch strategies" });
		}
	},
);

router.get(
	"/expiry-calendar",
	async (_req: Request, res: Response): Promise<void> => {
		try {
			const calendar = derivativesService.getExpiryCalendar();
			res.json({ calendar });
		} catch (error: unknown) {
			logger.error(
				"[Derivatives] Error fetching expiry calendar:",
				errorMessage(error),
			);
			res.status(500).json({ error: "Failed to fetch expiry calendar" });
		}
	},
);

router.get(
	"/positions",
	async (req: Request, res: Response): Promise<void> => {
		try {
			const userId = (req.user as any)?.id || "demo-user";
			const positions = await db
				.select()
				.from(derivativePositions)
				.where(eq(derivativePositions.userId, userId))
				.orderBy(desc(derivativePositions.createdAt))
				.limit(50);

			res.json({
				success: true,
				positions: positions.map((p) => ({
					id: p.id,
					symbol: p.tradingsymbol,
					type: p.tradingsymbol.endsWith("CE")
						? "call"
						: p.tradingsymbol.endsWith("PE")
							? "put"
							: "future",
					expiry: p.tradingsymbol,
					quantity: p.quantity,
					buyPrice: Number(p.averagePrice),
					currentPrice: Number(p.currentPrice || p.averagePrice),
					pnl: Number(p.unrealizedPnl || 0),
					pnlPercentage:
						Number(p.averagePrice) > 0
							? Math.round(
									((Number(p.currentPrice || p.averagePrice) - Number(p.averagePrice)) /
										Number(p.averagePrice)) *
										100 *
										100
								) / 100
							: 0,
					side: p.side,
					product: p.product,
					status: p.status,
				})),
				meta: {
					timestamp: new Date().toISOString(),
					count: positions.length,
				},
			});
		} catch (error: unknown) {
			logger.error(
				"[Derivatives] Error fetching positions:",
				errorMessage(error),
			);
			res.status(500).json({ error: "Failed to fetch derivatives positions" });
		}
	},
);

/**
 * GET /api/derivatives/contracts/:symbol
 * Fetches tradable F&O contracts for an underlying symbol (e.g., NIFTY, BANKNIFTY, RELIANCE).
 * Queries `derivative_contracts` table with live Upstox fallback.
 */
router.get(
	"/contracts/:symbol",
	async (req: Request<{ symbol: string }>, res: Response): Promise<void> => {
		try {
			const symbol = req.params.symbol.toUpperCase();

			// 1. Check PostgreSQL DB
			const rows = await db
				.select()
				.from(derivativeContracts)
				.where(
					and(
						eq(derivativeContracts.underlyingSymbol, symbol),
						eq(derivativeContracts.isActive, true)
					)
				)
				.orderBy(derivativeContracts.expiryDate, derivativeContracts.strikePrice)
				.limit(200);

			if (rows.length > 0) {
				res.json({
					success: true,
					symbol,
					contracts: rows,
					source: "db",
					meta: { timestamp: new Date().toISOString(), count: rows.length },
				});
				return;
			}

			// 2. Fallback to live Upstox Option Contracts API
			const upstoxRes = await upstoxMarketDataService.getOptionContracts(symbol);
			if (upstoxRes.success && upstoxRes.data) {
				res.json({
					success: true,
					symbol,
					contracts: upstoxRes.data,
					source: "upstox",
					meta: { timestamp: new Date().toISOString(), count: upstoxRes.data.length },
				});
				return;
			}

			res.json({
				success: true,
				symbol,
				contracts: [],
				source: "none",
				meta: { timestamp: new Date().toISOString(), count: 0 },
			});
		} catch (error: unknown) {
			logger.error("[Derivatives] Error fetching contracts:", errorMessage(error));
			res.status(500).json({ error: "Failed to fetch derivative contracts" });
		}
	}
);

/**
 * POST /api/derivatives/order/validate
 * Pre-trade compliance & suitability check adhering strictly to:
 * - SEBI Index Derivatives Framework Circular SEBI/HO/MRD/POD1/CIR/P/2024/132
 * - FintekPro Statutory SOP-DERIVATIVES-v1.0 & GCR v1.0
 */
router.post(
	"/order/validate",
	async (
		req: Request<
			any,
			any,
			{
				symbol: string;
				tradingsymbol: string;
				quantity: number;
				side: "BUY" | "SELL";
				expiryDate: string;
				isWeekly?: boolean;
				riskProfile?: string;
				price?: number;
				availableMargin?: number;
			}
		>,
		res: Response
	): Promise<void> => {
		try {
			const {
				symbol,
				tradingsymbol,
				quantity,
				side,
				expiryDate,
				isWeekly = false,
				riskProfile = "aggressive",
				price = 0,
				availableMargin = 1000000,
			} = req.body;

			if (!symbol || !quantity || !side || !expiryDate) {
				res.status(400).json({
					success: false,
					error: "Missing required order validation fields (symbol, quantity, side, expiryDate)",
				});
				return;
			}

			const upperSym = symbol.toUpperCase();

			// 1. Risk Profile Gate
			if (riskProfile === "conservative" || riskProfile === "moderate") {
				res.status(403).json({
					success: false,
					allowed: false,
					error_code: "SUITABILITY_GATE_FAILED",
					message:
						"SEBI IA Regulations: Derivative trading is restricted to clients with an aggressive or very aggressive risk profile.",
					regulatoryNotices: [
						"High Risk Warning: 9 out of 10 individual traders in equity F&O segment incur net losses (SEBI Study).",
					],
				});
				return;
			}

			// 2. Weekly Expiry Eligibility (SEBI 2026 Circular 132)
			const weeklyCheck = validateWeeklyExpiryEligibility(upperSym, isWeekly);
			if (!weeklyCheck.allowed) {
				res.status(400).json({
					success: false,
					allowed: false,
					error_code: weeklyCheck.error,
					message: weeklyCheck.message,
				});
				return;
			}

			// 3. Lot Size Multiplier Validation
			const lotSizes = (await derivativesService.getAvailableSymbols()).lotSizes;
			const lotSize = lotSizes[upperSym] || 50;

			if (quantity % lotSize !== 0 || quantity <= 0) {
				res.status(400).json({
					success: false,
					allowed: false,
					error_code: "INVALID_LOT_SIZE",
					message: `Quantity (${quantity}) must be an exact positive multiple of the contract lot size (${lotSize}).`,
					lotSize,
				});
				return;
			}

			// 4. Margin Computation & 50% Cash Margin Rule
			const spotPrice = await derivativesService.getSpotPrice(upperSym);
			const contractValue = spotPrice * quantity;
			const isShort = side.toUpperCase() === "SELL";

			// Estimated SPAN + Exposure Margin (~15-20% for futures / short options)
			let estimatedMargin = isShort
				? Math.round(contractValue * 0.18)
				: Math.round((price || spotPrice * 0.02) * quantity);

			// Expiry Day ELM Surcharge (+2% on short positions on expiry day)
			const todayStr = new Date().toISOString().split("T")[0];
			const isExpiryDay = expiryDate === todayStr;
			let elmSurcharge = 0;

			if (isShort && isExpiryDay) {
				elmSurcharge = Math.round(contractValue * (SEBI_FNO_FRAMEWORK_2026.EXPIRY_DAY_ELM_SURCHARGE_PCT / 100));
				estimatedMargin += elmSurcharge;
			}

			const minCashMarginRequired = Math.round(
				estimatedMargin * (SEBI_FNO_FRAMEWORK_2026.CASH_MARGIN_MIN_PCT / 100)
			);

			const isMarginSufficient = availableMargin >= estimatedMargin;

			res.json({
				success: true,
				allowed: isMarginSufficient,
				data: {
					symbol: upperSym,
					tradingsymbol,
					quantity,
					lotSize,
					lots: quantity / lotSize,
					estimatedMargin,
					minCashMarginRequired,
					availableMargin,
					marginDeficit: isMarginSufficient ? 0 : estimatedMargin - availableMargin,
					isExpiryDay,
					elmSurchargeApplied: elmSurcharge > 0,
					elmSurchargeAmount: elmSurcharge,
					regulatoryNotices: [
						SEBI_FNO_FRAMEWORK_2026.CASH_MARGIN_DISCLAIMER,
						...(isExpiryDay && isShort ? [SEBI_FNO_FRAMEWORK_2026.EXPIRY_DAY_ELM_DISCLAIMER] : []),
						"SEBI Risk Disclosure: Trading in derivatives involves substantial risk of loss and is not suitable for every investor.",
					],
				},
				meta: {
					timestamp: new Date().toISOString(),
					version: "SEBI-FNO-2026-v1.0",
					engine: "GCR-1.0",
				},
			});
		} catch (error: unknown) {
			logger.error("[Derivatives] Error validating order:", errorMessage(error));
			res.status(500).json({ error: "Failed to validate derivative order" });
		}
	}
);

/**
 * POST /api/derivatives/order/execute
 * Places an idempotent derivative trade with full audit trail.
 */
router.post(
	"/order/execute",
	requireAuth,
	async (
		req: Request<
			any,
			any,
			{
				symbol: string;
				tradingsymbol: string;
				instrumentKey: string;
				quantity: number;
				price: number;
				side: "BUY" | "SELL";
				product?: "I" | "D";
				idempotencyKey?: string;
			}
		>,
		res: Response
	): Promise<void> => {
		const t0 = Date.now();
		try {
			// Check Global Kill Switch
			const killSwitch = riskEngine.getGlobalKillSwitchStatus();
			if (killSwitch.active) {
				res.status(503).json({
					success: false,
					error: "GLOBAL_KILL_SWITCH_ACTIVE",
					message: `Derivative order execution halted: ${killSwitch.reason}`,
					meta: { killSwitch },
				});
				return;
			}

			const {
				symbol,
				tradingsymbol,
				instrumentKey,
				quantity,
				price,
				side,
				product = "I",
				idempotencyKey = `fp-der-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
			} = req.body;

			const userId = (req.user as any)?.id;
			if (!userId) {
				res.status(401).json({ success: false, error: "Authentication required" });
				return;
			}

			if (!symbol || !tradingsymbol || !quantity || !side || !price) {
				res.status(400).json({
					success: false,
					error: "Missing required order execution fields (symbol, tradingsymbol, quantity, side, price)",
				});
				return;
			}

			// 1. Idempotency Check
			const existing = await db
				.select()
				.from(derivativePositions)
				.where(eq(derivativePositions.idempotencyKey, idempotencyKey))
				.limit(1);

			if (existing.length > 0) {
				res.json({
					success: true,
					message: "Order already executed (idempotency key matched)",
					data: existing[0],
					meta: { timestamp: new Date().toISOString(), duplicate: true },
				});
				return;
			}

			// 2. Persist Position to Database
			const [position] = await db
				.insert(derivativePositions)
				.values({
					userId,
					instrumentKey: instrumentKey || `NSE_FO|${tradingsymbol}`,
					tradingsymbol,
					underlyingSymbol: symbol.toUpperCase(),
					exchange: "NSE_FO",
					product,
					side: side.toUpperCase() as "BUY" | "SELL",
					quantity,
					averagePrice: price.toString(),
					currentPrice: price.toString(),
					unrealizedPnl: "0",
					realizedPnl: "0",
					status: "OPEN",
					idempotencyKey,
					source: "fintekpro_dma",
				})
				.returning();

			// 3. Structured Audit Log
			logger.info("DERIVATIVE_ORDER_PLACED", {
				event: "DERIVATIVE_ORDER_PLACED",
				user_id: userId,
				instrument_key: instrumentKey,
				tradingsymbol,
				side,
				quantity,
				price,
				product,
				idempotency_key: idempotencyKey,
				latency_ms: Date.now() - t0,
				status: "success",
			});

			res.json({
				success: true,
				message: `Derivative ${side} order placed successfully for ${quantity} units of ${tradingsymbol}.`,
				data: position,
				meta: {
					timestamp: new Date().toISOString(),
					version: "GCR-1.0",
					latency_ms: Date.now() - t0,
				},
			});
		} catch (error: unknown) {
			logger.error("[Derivatives] Error executing order:", errorMessage(error));
			res.status(500).json({ error: "Failed to execute derivative order" });
		}
	}
);

/**
 * POST /api/derivatives/sync-contracts
 * Triggers background sync of active F&O contracts from Upstox to database.
 */
router.post(
	"/sync-contracts",
	async (req: Request<any, any, { symbols?: string[] }>, res: Response): Promise<void> => {
		try {
			const symbols = req.body.symbols || ["NIFTY", "BANKNIFTY", "FINNIFTY", "SENSEX", "RELIANCE", "TCS", "HDFCBANK", "INFY"];
			const result = await upstoxMarketDataService.syncDerivativeContracts(symbols);
			res.json({
				success: true,
				message: `Synced ${result.synced} contracts (${result.failed} failures).`,
				data: result,
				meta: { timestamp: new Date().toISOString() },
			});
		} catch (error: unknown) {
			logger.error("[Derivatives] Error syncing contracts:", errorMessage(error));
			res.status(500).json({ error: "Failed to sync derivative contracts" });
		}
	}
);

/**
 * GET /api/derivatives/algo/signals
 * Returns quantitative Long-Short signals (Statistical Arbitrage, Beta Hedged, Volatility Spreads).
 * Complies with FASP-AI v1.0 DSS: Decision Support Only.
 */
router.get("/algo/signals", async (_req: Request, res: Response): Promise<void> => {
	const t0 = Date.now();
	try {
		const signals = await longShortAlgoEngine.getActiveSignals();
		res.json({
			success: true,
			data: signals,
			meta: {
				count: signals.length,
				timestamp: new Date().toISOString(),
				version: "GPE-LS-v1.0",
				latency_ms: Date.now() - t0,
			},
		});
	} catch (error: unknown) {
		logger.error("[Derivatives] Error fetching Long-Short algo signals:", errorMessage(error));
		res.status(500).json({ error: "Failed to fetch Long-Short signals" });
	}
});

/**
 * POST /api/derivatives/algo/stage-basket
 * Stages an atomic multi-leg Long-Short basket with BUY-first leg sequencing.
 */
router.post(
	"/algo/stage-basket",
	requireAuth,
	async (
		req: Request<
			any,
			any,
			{
				signalId: string;
				lots?: number;
				clientRiskProfile?: string;
				isFnoCleared?: boolean;
			}
		>,
		res: Response
	): Promise<void> => {
		try {
			const killSwitch = riskEngine.getGlobalKillSwitchStatus();
			if (killSwitch.active) {
				res.status(503).json({
					success: false,
					error: "GLOBAL_KILL_SWITCH_ACTIVE",
					message: `Algo staging halted: ${killSwitch.reason}`,
					meta: { killSwitch },
				});
				return;
			}

			const { signalId, lots = 1, clientRiskProfile = "aggressive", isFnoCleared = true } = req.body;
			if (!signalId) {
				res.status(400).json({ success: false, error: "Missing required signalId parameter" });
				return;
			}

			const stagedBasket = await longShortAlgoEngine.stageBasket({
				signalId,
				lots,
				clientRiskProfile,
				isFnoCleared,
			});

			res.json({
				success: true,
				message: `Staged Long-Short basket for ${stagedBasket.pairName} with ${stagedBasket.sequencedLegs.length} legs.`,
				data: stagedBasket,
				meta: { timestamp: new Date().toISOString() },
			});
		} catch (error: unknown) {
			const msg = errorMessage(error);
			if (msg.includes("SUITABILITY_GATE_FAILED")) {
				res.status(403).json({ success: false, error_code: "SUITABILITY_GATE_FAILED", message: msg });
				return;
			}
			logger.error("[Derivatives] Error staging Long-Short basket:", msg);
			res.status(500).json({ success: false, error: msg });
		}
	}
);

/**
 * POST /api/derivatives/algo/execute-basket
 * Idempotently executes a staged Long-Short basket following explicit human confirmation.
 */
router.post(
	"/algo/execute-basket",
	requireAuth,
	async (
		req: Request<
			any,
			any,
			{
				basket: any;
				confirmedVia: "CLIENT_1CLICK_AUTH" | "ADVISOR_PORTAL_SIGN_OFF";
			}
		>,
		res: Response
	): Promise<void> => {
		try {
			const killSwitch = riskEngine.getGlobalKillSwitchStatus();
			if (killSwitch.active) {
				res.status(503).json({
					success: false,
					error: "GLOBAL_KILL_SWITCH_ACTIVE",
					message: `Algo basket execution halted: ${killSwitch.reason}`,
					meta: { killSwitch },
				});
				return;
			}

			const { basket, confirmedVia = "CLIENT_1CLICK_AUTH" } = req.body;
			if (!basket || !basket.basketId || !basket.sequencedLegs) {
				res.status(400).json({ success: false, error: "Invalid basket payload for execution" });
				return;
			}

			const userId = (req.user as any)?.id;
			if (!userId) {
				res.status(401).json({ success: false, error: "Authentication required" });
				return;
			}
			const result = await longShortAlgoEngine.executeBasket({
				basket,
				userId,
				confirmedVia,
			});

			res.json({
				success: true,
				message: `Long-Short basket ${basket.basketId} executed successfully across ${result.executedOrders.length} legs.`,
				data: result,
				meta: { timestamp: new Date().toISOString() },
			});
		} catch (error: unknown) {
			logger.error("[Derivatives] Error executing Long-Short basket:", errorMessage(error));
			res.status(500).json({ success: false, error: "Failed to execute Long-Short basket", details: errorMessage(error) });
		}
	}
);

export default router;
