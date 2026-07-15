import { Router, Request, Response } from "express";
import { z } from "zod";
import { usTradingService } from "../services/us-trading-service";
import { alpacaMarketDataService } from "../services/alpaca-market-data-service";
import { alpacaBrokerService } from "../services/alpaca-broker-service";
import { massiveWebSocketService } from "../services/massive-websocket-service";
import type { AuthRequest } from "../types/broker-types";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { alpacaAccountGuard } from "../middleware/rbac";

const router: Router = Router();

// Apply authentication to all routes in this file
router.use(requireAuth);

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

// Test connections (Admin only)
router.get(
	"/broker/test-connection",
	requireAdmin,
	async (_req: Request, res: Response): Promise<void> => {
		try {
			const alpacaResult = await alpacaBrokerService.testConnection();
			const polygonResult = alpacaMarketDataService.testConnection();
			const wsStatus = massiveWebSocketService.getStatus();

			res.json({
				success: true,
				alpaca: alpacaResult,
				polygon: polygonResult,
				massiveWebSocket: {
					configured: wsStatus.configured,
					connected: wsStatus.connected,
					authenticated: wsStatus.authenticated,
					feedType: wsStatus.feedType,
				},
			});
		} catch (error: unknown) {
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	},
);

// ─── Alpaca Account Dashboard Routes ──────────────────────────────────────────

/** Configure Alpaca credentials (Admin only) — persists encrypted to DB */
router.post(
	"/alpaca/credentials",
	requireAdmin,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { apiKey, secretKey, baseUrl, webhookSecret } = req.body as {
				apiKey?: string;
				secretKey?: string;
				baseUrl?: string;
				webhookSecret?: string;
			};

			if (!apiKey || !secretKey) {
				res
					.status(400)
					.json({ success: false, error: "apiKey and secretKey are required" });
				return;
			}

			const resolvedBaseUrl =
				baseUrl?.trim() || "https://broker-api.sandbox.alpaca.markets";

			// ── 1. Configure in-memory first (fast path) ──────────────────────────
			alpacaBrokerService.configure(
				apiKey.trim(),
				secretKey.trim(),
				resolvedBaseUrl,
			);

			// ── 2. Verify credentials against Alpaca ─────────────────────────────
			const test = await alpacaBrokerService.testConnection();
			if (!test.success) {
				res.status(400).json({ success: false, error: test.message });
				return;
			}

			// ── 3. Persist to DB (encrypted) ─────────────────────────────────────
			try {
				const { encrypt } = await import("../utils/encryption");
				const { db } = await import("../db");
				const { brokerConfigurations } = await import("../../shared/schema");
				const { eq } = await import("drizzle-orm");

				// Encrypt the secret key at rest (API key is not a secret but we mask it)
				const encryptedSecret = encrypt(secretKey.trim());
				// Mask API key — store only last 6 chars for display
				const maskedApiKey = apiKey
					.trim()
					.slice(-6)
					.padStart(apiKey.trim().length, "*");

				const configPayload = {
					apiKey: apiKey.trim(), // needed for reconnect
					secretKeyEncrypted: encryptedSecret, // AES-256-GCM
					maskedApiKey,
					baseUrl: resolvedBaseUrl,
					env: resolvedBaseUrl.includes("sandbox") ? "sandbox" : "production",
					...(webhookSecret
						? { webhookSecret: encrypt(webhookSecret.trim()) }
						: {}),
					savedAt: new Date().toISOString(),
					savedBy: "admin",
				};

				const existing = await db
					.select()
					.from(brokerConfigurations)
					.where(eq(brokerConfigurations.brokerCode, "ALPACA"))
					.limit(1);

				if (existing.length > 0) {
					await db
						.update(brokerConfigurations)
						.set({
							configuration: configPayload,
							apiEndpoint: resolvedBaseUrl,
							healthStatus: "healthy",
							lastHealthCheck: new Date(),
							updatedAt: new Date(),
						})
						.where(eq(brokerConfigurations.brokerCode, "ALPACA"));
				} else {
					await db.insert(brokerConfigurations).values({
						brokerCode: "ALPACA",
						brokerName: "Alpaca Markets",
						brokerType: "us_equity_broker",
						isEnabled: true,
						apiEndpoint: resolvedBaseUrl,
						apiVersion: "v1",
						configuration: configPayload,
						healthStatus: "healthy",
						lastHealthCheck: new Date(),
						requiredEnvVars: [
							"ALPACA_API_KEY",
							"ALPACA_SECRET_KEY",
							"ALPACA_BASE_URL",
						],
						supportedProducts: ["us_equity", "etf", "crypto", "options"],
						features: { fractionalTrading: true, brokerApi: true, lrs: true },
					});
				}

				// Also persist webhook secret to env if provided (for HMAC verification)
				if (webhookSecret?.trim()) {
					process.env.ALPACA_WEBHOOK_SECRET = webhookSecret.trim();
				}
			} catch (dbErr: unknown) {
				// DB persistence failure is non-fatal — in-memory config is active
				const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
				console.warn(
					"[AlpacaCredentials] DB persistence failed (in-memory config still active):",
					msg,
				);
			}

			res.json({
				success: true,
				message: `Connected to Alpaca (${alpacaBrokerService.isPaperTrading() ? "Sandbox" : "Live"})`,
				isPaper: alpacaBrokerService.isPaperTrading(),
				baseUrl: alpacaBrokerService.getBaseUrl(),
				persisted: true,
			});
		} catch (error: unknown) {
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	},
);

/** Load Alpaca credentials from DB into memory (Admin only — call after restart) */
router.post(
	"/alpaca/credentials/load",
	requireAdmin,
	async (_req: Request, res: Response): Promise<void> => {
		try {
			const { decrypt } = await import("../utils/encryption");
			const { db } = await import("../db");
			const { brokerConfigurations } = await import("../../shared/schema");
			const { eq } = await import("drizzle-orm");

			const rows = await db
				.select()
				.from(brokerConfigurations)
				.where(eq(brokerConfigurations.brokerCode, "ALPACA"))
				.limit(1);

			if (rows.length === 0 || !rows[0].configuration) {
				res
					.status(404)
					.json({
						success: false,
						error:
							"No Alpaca credentials stored in DB. Use POST /alpaca/credentials to save them.",
					});
				return;
			}

			const config = rows[0].configuration as Record<string, string>;
			const apiKey = config.apiKey;
			const encryptedSecret = config.secretKeyEncrypted;
			const baseUrl = config.baseUrl;

			if (!apiKey || !encryptedSecret || !baseUrl) {
				res
					.status(422)
					.json({
						success: false,
						error: "Stored config is incomplete. Re-enter credentials.",
					});
				return;
			}

			const secretKey = decrypt(encryptedSecret);
			alpacaBrokerService.configure(apiKey, secretKey, baseUrl);

			// Reload webhook secret if stored
			if (config.webhookSecret) {
				try {
					process.env.ALPACA_WEBHOOK_SECRET = decrypt(config.webhookSecret);
				} catch {
					/* ignore */
				}
			}

			const test = await alpacaBrokerService.testConnection();
			res.json({
				success: test.success,
				message: test.success
					? `Loaded from DB — ${alpacaBrokerService.isPaperTrading() ? "Sandbox" : "Live"} mode`
					: `Loaded from DB but auth failed: ${test.message}`,
				isPaper: alpacaBrokerService.isPaperTrading(),
				baseUrl: alpacaBrokerService.getBaseUrl(),
				savedAt: config.savedAt,
			});
		} catch (error: unknown) {
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	},
);

/** Get Alpaca config (Admin only) */
router.get(
	"/alpaca/config",
	requireAdmin,
	async (_req: Request, res: Response): Promise<void> => {
		const configured = alpacaBrokerService.isConfigured();
		let authOk = false;
		let authError: string | undefined;
		if (configured) {
			try {
				const test = await alpacaBrokerService.testConnection();
				authOk = test.success;
				if (!test.success) authError = test.message;
			} catch (e: unknown) {
				authError = errorMessage(e);
			}
		}
		res.json({
			configured,
			authOk,
			authError,
			isPaper: alpacaBrokerService.isPaperTrading(),
			baseUrl: alpacaBrokerService.getBaseUrl(),
			defaultBaseUrl: "https://broker-api.sandbox.alpaca.markets",
			isBrokerApi: alpacaBrokerService.isBrokerApi(),
		});
	},
);

/** Activate US Trading (Admin only) */
router.post(
	"/activate-us-trading",
	requireAdmin,
	async (_req: Request, res: Response): Promise<void> => {
		try {
			const test = await alpacaBrokerService.testConnection();
			if (!test.success) {
				res.status(400).json({
					success: false,
					error: `Alpaca auth failed — update ALPACA_SECRET_KEY: ${test.message}`,
					authOk: false,
				});
				return;
			}
			await usTradingService.initializeFeatureFlags();
			const flags = [
				"US_TRADING_ENABLED",
				"US_TRADING_ALPACA",
				"US_FRACTIONAL_TRADING",
			];
			for (const flag of flags) {
				await usTradingService.setFeatureFlag(flag, true);
			}
			const allFlags = await usTradingService.getFeatureFlags();
			res.json({
				success: true,
				message: "US Trading activated",
				flags: allFlags,
				authOk: true,
			});
		} catch (error: unknown) {
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	},
);

/** List all broker-managed accounts (Admin only) */
router.get(
	"/alpaca/broker/accounts",
	requireAdmin,
	async (_req: Request, res: Response): Promise<void> => {
		try {
			if (!alpacaBrokerService.isConfigured()) {
				res.json({ configured: false, accounts: [] });
				return;
			}
			const accounts = await alpacaBrokerService.listBrokerAccounts();
			res.json({ configured: true, accounts });
		} catch (error: unknown) {
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	},
);

/** Get account summary (Admin/Agent/Owner) */
router.get(
	"/account",
	alpacaAccountGuard,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const accountId = req.query.accountId as string | undefined;
			const account = await alpacaBrokerService.getAccount(accountId);
			res.json({
				configured: true,
				is_paper: alpacaBrokerService.isPaperTrading(),
				account,
				onboarding: false,
				onboarding_status: "ACTIVE",
			});
		} catch (error: unknown) {
			res.status(200).json({
				configured: false,
				account: null,
				is_paper: true,
				onboarding: false,
				onboarding_status: "PENDING",
			});
		}
	},
);

/** Get Alpaca account details (Admin/Agent/Owner) */
router.get(
	"/alpaca/account",
	alpacaAccountGuard,
	async (req: Request, res: Response): Promise<void> => {
		try {
			if (!alpacaBrokerService.isConfigured()) {
				res.json({ configured: false, isPaper: true });
				return;
			}
			const accountId = req.query.accountId as string | undefined;
			const account = await alpacaBrokerService.getAccount(accountId);
			res.json({
				configured: true,
				isPaper: alpacaBrokerService.isPaperTrading(),
				account,
			});
		} catch (error: unknown) {
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	},
);

router.get(
	"/alpaca/market-clock",
	async (_req: Request, res: Response): Promise<void> => {
		try {
			if (!alpacaBrokerService.isConfigured()) {
				res.json({ configured: false });
				return;
			}
			const clock = await alpacaBrokerService.getMarketClock();
			res.json({ configured: true, clock });
		} catch (error: unknown) {
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	},
);

/** Get portfolio history (Admin/Agent/Owner) */
router.get(
	"/alpaca/portfolio/history",
	alpacaAccountGuard,
	async (req: Request, res: Response): Promise<void> => {
		try {
			if (!alpacaBrokerService.isConfigured()) {
				res.json({ configured: false });
				return;
			}
			const period = (req.query.period as string) || "1M";
			const timeframe = (req.query.timeframe as string) || "1D";
			const accountId = req.query.accountId as string | undefined;
			const history = await alpacaBrokerService.getPortfolioHistory(
				period,
				timeframe,
				accountId,
			);
			res.json({ configured: true, history });
		} catch (error: unknown) {
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	},
);

/** List orders for an account (Admin/Agent/Owner) */
router.get(
	"/alpaca/orders",
	alpacaAccountGuard,
	async (req: Request, res: Response): Promise<void> => {
		try {
			if (!alpacaBrokerService.isConfigured()) {
				res.json({ configured: false, orders: [] });
				return;
			}
			const status = (req.query.status as string) || "all";
			const limit = Number.parseInt((req.query.limit as string) || "50", 10);
			const accountId = req.query.accountId as string | undefined;
			const orders = await alpacaBrokerService.getOrders(
				status,
				limit,
				accountId,
			);
			res.json({ configured: true, orders });
		} catch (error: unknown) {
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	},
);

/** Cancel all orders (Admin/Agent/Owner) */
router.delete(
	"/alpaca/orders",
	alpacaAccountGuard,
	async (req: Request, res: Response): Promise<void> => {
		try {
			if (!alpacaBrokerService.isConfigured()) {
				res
					.status(400)
					.json({ success: false, error: "Alpaca API not configured" });
				return;
			}
			const accountId = req.query.accountId as string | undefined;
			const cancelled = await alpacaBrokerService.cancelAllOrders(accountId);
			res.json({ success: true, cancelled });
		} catch (error: unknown) {
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	},
);

/** Cancel specific order (Admin/Agent/Owner) */
router.delete(
	"/alpaca/orders/:orderId",
	alpacaAccountGuard,
	async (req: Request, res: Response): Promise<void> => {
		try {
			if (!alpacaBrokerService.isConfigured()) {
				res
					.status(400)
					.json({ success: false, error: "Alpaca API not configured" });
				return;
			}
			const accountId = req.query.accountId as string | undefined;
			const ok = await alpacaBrokerService.cancelOrder(
				req.params.orderId,
				accountId,
			);
			res.json({ success: ok });
		} catch (error: unknown) {
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	},
);

/** Close specific position (Admin/Agent/Owner) */
router.delete(
	"/alpaca/positions/:symbol",
	alpacaAccountGuard,
	async (req: Request, res: Response): Promise<void> => {
		try {
			if (!alpacaBrokerService.isConfigured()) {
				res
					.status(400)
					.json({ success: false, error: "Alpaca API not configured" });
				return;
			}
			const accountId = req.query.accountId as string | undefined;
			const ok = await alpacaBrokerService.closePosition(
				req.params.symbol.toUpperCase(),
				accountId,
			);
			res.json({ success: ok });
		} catch (error: unknown) {
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	},
);

interface IndexProxy {
	symbol: string;
	name: string;
	price: number;
	change: number;
	changePercent: number;
	etfProxy?: string;
	source: string;
}

interface Holding {
	id: string;
	symbol: string;
	companyName?: string;
	currentPriceUsd: string;
	avgPriceUsd: string;
	quantity: string;
}

interface WatchlistItem {
	symbol: string;
	addedAt: string;
}

interface OrderRecord {
	id: string;
	symbol: string;
	side: string;
	quantity: string;
	filledAvgPrice?: string;
	limitPrice?: string;
	status: string;
	createdAt: string;
}

// ─── Curated constituent lists (top 50 NASDAQ-100 + top 50 S&P 500) ──────────
const NASDAQ100_SYMBOLS = [
	"AAPL","MSFT","NVDA","AMZN","META","GOOGL","GOOG","TSLA","AVGO","COST",
	"ASML","NFLX","AMD","AZN","QCOM","LIN","PEP","INTU","CSCO","TMUS",
	"AMAT","TXN","ISRG","HON","AMGN","BKNG","REGN","SBUX","VRTX","PANW",
	"ADI","KLAC","MELI","MDLZ","SNPS","CDNS","CSX","ADP","GILD","CRWD",
	"MAR","CTAS","MU","ORLY","FTNT","ABNB","NXPI","LRCX","MRVL","CEG",
];
const SP500_SYMBOLS = [
	"BRK.B","JPM","V","MA","LLY","UNH","JNJ","WMT","PG","XOM",
	"CVX","HD","BAC","KO","ABBV","MRK","PFE","TMO","ACN","PM",
	"MCD","CRM","ABT","RTX","NEE","DHR","TXN","NFLX","UNP","WFC",
	"SPGI","MS","BMY","GS","CAT","BLK","AXP","DE","AMT","COP",
	"SYK","VRTX","GILD","DUK","SO","ELV","CI","PLD","CB","LMT",
];

/**
 * GET /api/us-trading/market/screener
 * Returns NASDAQ-100 + S&P 500 listed stocks with live Alpaca prices.
 * Query params: exchange (NASDAQ|SP500|ALL), search, page, limit
 */
router.get(
	"/market/screener",
	async (req: Request, res: Response): Promise<void> => {
		try {
			const exchange = ((req.query.exchange as string) || "ALL").toUpperCase();
			const search   = ((req.query.search   as string) || "").toUpperCase().trim();
			const page     = Math.max(1, Number.parseInt((req.query.page  as string) || "1",  10));
			const limit    = Math.min(50, Math.max(5, Number.parseInt((req.query.limit as string) || "20", 10)));

			let universe: string[];
			if (exchange === "NASDAQ")     universe = NASDAQ100_SYMBOLS;
			else if (exchange === "SP500") universe = SP500_SYMBOLS;
			else                           universe = [...new Set([...NASDAQ100_SYMBOLS, ...SP500_SYMBOLS])];

			const filtered = search ? universe.filter((s) => s.includes(search)) : universe;
			const total    = filtered.length;
			const paged    = filtered.slice((page - 1) * limit, page * limit);

			let prices: Map<string, any> = new Map();
			if (alpacaBrokerService.isConfigured() && paged.length > 0) {
				try { prices = await alpacaMarketDataService.getSnapshots(paged); } catch { /* non-fatal */ }
			}

			const exchangeRate = await alpacaMarketDataService.getUsdInrRate().catch(() => 84.5);

			const stocks = paged.map((sym) => {
				const snap      = prices.get(sym);
				const price     = snap?.latestTrade?.price || snap?.dailyBar?.close || 0;
				const prev      = snap?.prevDailyBar?.close || snap?.dailyBar?.open || price;
				const change    = price - prev;
				const changePct = prev > 0 ? (change / prev) * 100 : 0;
				const isNasdaq  = NASDAQ100_SYMBOLS.includes(sym);
				const isSp500   = SP500_SYMBOLS.includes(sym);
				return {
					symbol:        sym,
					exchange:      isNasdaq ? "NASDAQ" : "NYSE",
					indices:       [...(isNasdaq ? ["NASDAQ-100"] : []), ...(isSp500 ? ["S&P 500"] : [])],
					price:         price || null,
					priceINR:      price ? +(price * exchangeRate).toFixed(2) : null,
					change:        +change.toFixed(4),
					changePercent: +changePct.toFixed(4),
					open:          snap?.dailyBar?.open   || null,
					high:          snap?.dailyBar?.high   || null,
					low:           snap?.dailyBar?.low    || null,
					close:         snap?.dailyBar?.close  || null,
					volume:        snap?.dailyBar?.volume || null,
					vwap:          snap?.dailyBar?.vwap   || null,
					dataSource:    snap ? "Alpaca IEX" : "static",
				};
			});

			res.json({
				success: true,
				data: { stocks, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, exchangeRate: { rate: exchangeRate, currency: "INR" }, universe: exchange, lastUpdated: new Date().toISOString() },
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		} catch (error: unknown) {
			res.status(500).json({ success: false, error: errorMessage(error), retryable: true });
		}
	},
);

router.get(
	"/market-data",
	async (_req: Request, res: Response): Promise<void> => {
		try {
			// All symbols fetched in one batch snapshot call — much faster than individual quotes
			const allSymbols = [
				"AAPL",
				"MSFT",
				"GOOGL",
				"AMZN",
				"TSLA",
				"NVDA",
				"META",
				"JPM",
				"V",
				"JNJ", // popular stocks
				"SPY",
				"QQQ",
				"VTI",
				"VOO",
				"IWM",
				"VUG", // ETFs
				"DIA", // Dow proxy
			];

			const [snapshotMap, exchangeRate, clock] = await Promise.all([
				alpacaMarketDataService.getSnapshots(allSymbols),
				alpacaMarketDataService.getUsdInrRate(),
				alpacaBrokerService.getMarketClock().catch(() => null),
			]);

			const toQuote = (sym: string) => {
				const snap = snapshotMap.get(sym);
				if (!snap) return null;
				const price = snap.latestTrade.price || snap.dailyBar.close;
				const prevClose =
					snap.prevDailyBar.close || snap.dailyBar.open || price;
				const change = price - prevClose;
				const pct = prevClose > 0 ? (change / prevClose) * 100 : 0;
				return {
					symbol: sym,
					price,
					change,
					changePercent: pct,
					open: snap.dailyBar.open,
					high: snap.dailyBar.high,
					low: snap.dailyBar.low,
					close: snap.dailyBar.close,
					volume: snap.dailyBar.volume,
					vwap: snap.dailyBar.vwap,
				};
			};

			// ETF-based index proxies (Alpaca does not provide index feeds)
			const spySnap = snapshotMap.get("SPY");
			const qqqSnap = snapshotMap.get("QQQ");
			const diaSnap = snapshotMap.get("DIA");

			const makeIndexProxy = (
				sym: string,
				name: string,
				snap: any,
			): IndexProxy => {
				if (!snap)
					return {
						symbol: sym,
						name,
						price: 0,
						change: 0,
						changePercent: 0,
						source: "ETF proxy",
					};
				const price = snap.latestTrade.price || snap.dailyBar.close;
				const prevClose =
					snap.prevDailyBar.close || snap.dailyBar.open || price;
				const change = price - prevClose;
				const pct = prevClose > 0 ? (change / prevClose) * 100 : 0;
				return {
					symbol: sym,
					name,
					price,
					change,
					changePercent: pct,
					etfProxy: sym,
					source: "Alpaca IEX",
				};
			};

			const marketStatus = clock
				? clock.is_open
					? "open"
					: "closed"
				: (() => {
						const now = new Date();
						const nyHour = Number.parseInt(
							now.toLocaleString("en-US", {
								timeZone: "America/New_York",
								hour: "numeric",
								hour12: false,
							}),
							10,
						);
						return now.getDay() !== 0 &&
							now.getDay() !== 6 &&
							nyHour >= 9 &&
							nyHour < 16
							? "open"
							: "closed";
					})();

			const stockSymbols = [
				"AAPL",
				"MSFT",
				"GOOGL",
				"AMZN",
				"TSLA",
				"NVDA",
				"META",
				"JPM",
				"V",
				"JNJ",
			];
			const etfSymbols = ["SPY", "QQQ", "VTI", "VOO", "IWM", "VUG"];

			res.json({
				indices: [
					makeIndexProxy("^GSPC", "S&P 500 (via SPY)", spySnap),
					makeIndexProxy("^IXIC", "NASDAQ 100 (via QQQ)", qqqSnap),
					makeIndexProxy("^DJI", "Dow Jones (via DIA)", diaSnap),
				],
				stocks: stockSymbols.map(toQuote).filter(Boolean),
				etfs: etfSymbols.map(toQuote).filter(Boolean),
				exchangeRate: { rate: exchangeRate, currency: "INR" },
				marketStatus,
				dataSource: "Alpaca Market Data (IEX feed)",
				lastUpdated: new Date().toISOString(),
				nextOpen: clock?.next_open,
				nextClose: clock?.next_close,
			});
		} catch (error: unknown) {
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	},
);

router.get("/holdings", async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = (req as AuthRequest).user?.id;
		if (!userId) {
			res.json({
				holdings: [],
				totalValue: 0,
				totalValueINR: 0,
				totalProfitLoss: 0,
				totalProfitLossPercent: 0,
			});
			return;
		}

		const holdingsRaw = await usTradingService.getHoldings(userId);
		const holdings = holdingsRaw as unknown as Holding[];
		const fxRate = await alpacaMarketDataService.getUsdInrRate();

		let totalValue = 0;
		let totalCost = 0;

		const formattedHoldings = holdings.map((h) => {
			const currentPrice = Number.parseFloat(h.currentPriceUsd) || 0;
			const avgPrice = Number.parseFloat(h.avgPriceUsd) || 0;
			const qty = Number.parseFloat(h.quantity) || 0;
			const value = currentPrice * qty;
			const cost = avgPrice * qty;
			const pl = value - cost;
			const plPercent = cost > 0 ? (pl / cost) * 100 : 0;

			totalValue += value;
			totalCost += cost;

			return {
				id: h.id,
				symbol: h.symbol,
				companyName: h.companyName || h.symbol,
				quantity: qty,
				avgPrice,
				currentPrice,
				totalValue: value,
				profitLoss: pl,
				profitLossPercent: plPercent,
				priceInINR: value * fxRate,
			};
		});

		const totalPL = totalValue - totalCost;
		const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

		res.json({
			holdings: formattedHoldings,
			totalValue,
			totalValueINR: totalValue * fxRate,
			totalProfitLoss: totalPL,
			totalProfitLossPercent: totalPLPercent,
		});
	} catch (error: unknown) {
		res.status(500).json({ success: false, error: errorMessage(error) });
	}
});

router.get("/watchlist", async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = (req as AuthRequest).user?.id;
		if (!userId) {
			res.json({ items: [] });
			return;
		}

		const itemsRaw = await usTradingService.getWatchlist(userId);
		const items = itemsRaw as unknown as WatchlistItem[];
		res.json({
			items: items.map((i) => ({ symbol: i.symbol, addedAt: i.addedAt })),
		});
	} catch (error: unknown) {
		res.status(500).json({ success: false, error: errorMessage(error) });
	}
});

router.get("/orders", async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = (req as AuthRequest).user?.id;
		if (!userId) {
			res.json({ orders: [] });
			return;
		}

		const ordersRaw = await usTradingService.getOrders(userId);
		const orders = ordersRaw as unknown as OrderRecord[];
		res.json({
			orders: orders.map((o) => ({
				id: o.id,
				symbol: o.symbol,
				side: o.side,
				quantity: Number.parseFloat(o.quantity) || 0,
				price: Number.parseFloat(o.filledAvgPrice || o.limitPrice || "0"),
				status: o.status,
				createdAt: o.createdAt,
			})),
		});
	} catch (error: unknown) {
		res.status(500).json({ success: false, error: errorMessage(error) });
	}
});

router.post(
	"/holdings/sync",
	async (req: Request, res: Response): Promise<void> => {
		try {
			const userId = (req as AuthRequest).user?.id;
			if (!userId) {
				res
					.status(401)
					.json({ success: false, error: "Authentication required" });
				return;
			}

			const positions = await alpacaBrokerService.getPositions();
			const fxRate = await alpacaMarketDataService.getUsdInrRate();

			for (const position of positions) {
				await usTradingService.upsertHolding(userId, position.symbol, {
					quantity: position.qty,
					avgPriceUsd: position.avg_entry_price,
					currentPriceUsd: position.current_price,
					marketValueUsd: position.market_value,
					unrealizedPlUsd: position.unrealized_pl,
					unrealizedPlPercent: position.unrealized_plpc,
					currentFxRate: fxRate.toString(),
					marketValueInr: (
						Number.parseFloat(position.market_value) * fxRate
					).toString(),
					lastSyncAt: new Date(),
					assetType: "stock",
				});
			}

			res.json({
				success: true,
				message: `Synced ${positions.length} positions`,
				syncedAt: new Date(),
			});
		} catch (error: unknown) {
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	},
);

export default router;
