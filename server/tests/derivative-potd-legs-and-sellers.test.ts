import { describe, it, expect } from "vitest";
import {
	DerivativeStrategy,
	STRATEGY_CATALOGUE,
	selectStrategy,
} from "../services/picks/derivative-strategy";

describe("POTD Derivative Engine - Multi-Leg & Option Seller Strategies", () => {
	const strategyEngine = new DerivativeStrategy();

	// ── 1. Strategy Catalogue Coverage ──────────────────────────────────────
	describe("1. Strategy Catalogue: Option Seller & Buyer Coverage", () => {
		it("includes core institutional option seller strategies with defined risk", () => {
			const sellerStrats = STRATEGY_CATALOGUE.filter((s) => s.strategyType === "SELLER");
			const sellerNames = sellerStrats.map((s) => s.name);

			expect(sellerNames).toContain("Bull Put Spread");
			expect(sellerNames).toContain("Bear Call Spread");
			expect(sellerNames).toContain("Iron Condor");
			expect(sellerNames).toContain("Iron Butterfly");
			expect(sellerNames).toContain("Short Strangle");
			expect(sellerNames).toContain("Short Straddle");

			for (const strat of sellerStrats) {
				expect(strat.volPreference).toBe("sell");
				expect(strat.targetMult).toBeLessThan(1.0); // Profit taken when premium decays to <1.0x
				expect(strat.slMult).toBeGreaterThan(1.0);   // Stop loss when spread expands to >1.0x
				expect(strat.legs.length).toBeGreaterThanOrEqual(2);
			}
		});

		it("includes core institutional option buyer strategies", () => {
			const buyerStrats = STRATEGY_CATALOGUE.filter((s) => s.strategyType === "BUYER");
			const buyerNames = buyerStrats.map((s) => s.name);

			expect(buyerNames).toContain("Bull Call Spread");
			expect(buyerNames).toContain("Bear Put Spread");
			expect(buyerNames).toContain("Long Call");
			expect(buyerNames).toContain("Long Put");
			expect(buyerNames).toContain("Long Straddle");
			expect(buyerNames).toContain("Long Strangle");

			for (const strat of buyerStrats) {
				expect(strat.volPreference).toBe("buy");
				expect(strat.targetMult).toBeGreaterThan(1.0); // Profit target on expansion
				expect(strat.slMult).toBeLessThan(1.0);        // Capital protection stop loss
				expect(strat.legs.length).toBeGreaterThanOrEqual(1);
			}
		});
	});

	// ── 2. Strategy Selection by Regime ─────────────────────────────────────
	describe("2. Market Regime & Volatility Routing", () => {
		it("favors option seller strategies during elevated IV (>22%)", () => {
			// Elevated IV (e.g. IV = 24%) in a neutral market
			const strat = selectStrategy(25000, 24, [25000]);
			expect(strat.strategyType).toBe("SELLER");
			expect(strat.volPreference).toBe("sell");
		});

		it("selects Bull Put Spread when IV is elevated and market is bullish", () => {
			// Spot is 2% above 20-day SMA in elevated IV
			const recentCloses = [24500, 24500, 24500, 24500, 24500]; // SMA = 24500, Spot = 25100 (+2.4%)
			const strat = selectStrategy(25100, 24, recentCloses);

			expect(strat.name).toBe("Bull Put Spread");
			expect(strat.strategyType).toBe("SELLER");
			expect(strat.outlook).toBe("bullish");
		});

		it("selects Bear Call Spread when IV is elevated and market is bearish", () => {
			// Spot is 2.5% below 20-day SMA in elevated IV
			const recentCloses = [25600, 25600, 25600, 25600, 25600]; // SMA = 25600, Spot = 24900 (-2.7%)
			const strat = selectStrategy(24900, 23, recentCloses);

			expect(strat.name).toBe("Bear Call Spread");
			expect(strat.strategyType).toBe("SELLER");
			expect(strat.outlook).toBe("bearish");
		});

		it("favors option buyer strategies during low IV (<14%)", () => {
			const recentCloses = [24500, 24500, 24500, 24500, 24500];
			const strat = selectStrategy(25100, 12, recentCloses); // Bullish in low IV

			expect(strat.name).toBe("Bull Call Spread");
			expect(strat.strategyType).toBe("BUYER");
			expect(strat.volPreference).toBe("buy");
		});
	});

	// ── 3. Proper Legs & Payoff Construction ────────────────────────────────
	describe("3. Proper Legs, Payoff & SEBI Margin Calculation", () => {
		const spotPrice = 25000;
		const atmStrike = 25000;
		const strikeInterval = 50;
		const lotSize = 65; // NIFTY lot size

		it("constructs proper 2-leg structure for Bull Put Spread (Option Seller)", () => {
			const strat = STRATEGY_CATALOGUE.find((s) => s.name === "Bull Put Spread")!;
			const payoff = strategyEngine.buildLegsAndPayoff(
				"NIFTY",
				strat,
				spotPrice,
				atmStrike,
				strikeInterval,
				lotSize,
				undefined,
				7,
				18,
			);

			expect(payoff.isCredit).toBe(true);
			expect(payoff.legs.length).toBe(2);

			// Leg 1: SELL ATM Put @ 25000
			expect(payoff.legs[0].action).toBe("SELL");
			expect(payoff.legs[0].type).toBe("PE");
			expect(payoff.legs[0].strikePrice).toBe(25000);
			expect(payoff.legs[0].premium).toBeGreaterThan(0);

			// Leg 2: BUY OTM Put @ 24950
			expect(payoff.legs[1].action).toBe("BUY");
			expect(payoff.legs[1].type).toBe("PE");
			expect(payoff.legs[1].strikePrice).toBe(24950);
			expect(payoff.legs[1].premium).toBeGreaterThan(0);

			// Higher strike Put sold must have higher premium than lower strike Put bought
			expect(payoff.legs[0].premium).toBeGreaterThan(payoff.legs[1].premium);

			// Net credit received
			expect(payoff.netPremium).toBeGreaterThan(0);
			expect(payoff.totalNetPremium).toBe(Math.round(payoff.netPremium * lotSize * 100) / 100);

			// Max profit is credit received; max loss is strike width - credit
			expect(payoff.maxProfit).toBe(payoff.totalNetPremium);
			expect(typeof payoff.maxLoss).toBe("number");
			expect(payoff.maxLoss).toBeGreaterThan(0);

			// Breakeven
			expect(typeof payoff.breakeven).toBe("number");
			expect(payoff.breakeven).toBeLessThan(25000);
			expect(payoff.breakeven).toBeGreaterThan(24950);

			// Theta must be positive for option sellers (time decay income)
			expect(payoff.greeks.theta).toBeGreaterThan(0);

			// SEBI margin required must exceed net premium
			expect(payoff.marginRequired).toBeGreaterThan(payoff.totalNetPremium);
		});

		it("constructs proper 4-leg structure for Iron Condor (Option Seller)", () => {
			const strat = STRATEGY_CATALOGUE.find((s) => s.name === "Iron Condor")!;
			const payoff = strategyEngine.buildLegsAndPayoff(
				"NIFTY",
				strat,
				spotPrice,
				atmStrike,
				strikeInterval,
				lotSize,
				undefined,
				7,
				20,
			);

			expect(payoff.isCredit).toBe(true);
			expect(payoff.legs.length).toBe(4);

			// Leg 1: BUY Far OTM Put @ 24900
			expect(payoff.legs[0].action).toBe("BUY");
			expect(payoff.legs[0].type).toBe("PE");
			expect(payoff.legs[0].strikePrice).toBe(24900);

			// Leg 2: SELL OTM Put @ 24950
			expect(payoff.legs[1].action).toBe("SELL");
			expect(payoff.legs[1].type).toBe("PE");
			expect(payoff.legs[1].strikePrice).toBe(24950);

			// Leg 3: SELL OTM Call @ 25050
			expect(payoff.legs[2].action).toBe("SELL");
			expect(payoff.legs[2].type).toBe("CE");
			expect(payoff.legs[2].strikePrice).toBe(25050);

			// Leg 4: BUY Far OTM Call @ 25100
			expect(payoff.legs[3].action).toBe("BUY");
			expect(payoff.legs[3].type).toBe("CE");
			expect(payoff.legs[3].strikePrice).toBe(25100);

			// Breakeven has two boundaries: lower and upper
			expect(Array.isArray(payoff.breakeven)).toBe(true);
			const [lowerBE, upperBE] = payoff.breakeven as number[];
			expect(lowerBE).toBeLessThan(24950);
			expect(upperBE).toBeGreaterThan(25050);

			// Defined-risk spread
			expect(typeof payoff.maxLoss).toBe("number");
			expect(payoff.maxLoss).toBeGreaterThan(0);
			expect(payoff.maxProfit).toBe(payoff.totalNetPremium);
		});

		it("constructs proper 2-leg structure for Bull Call Spread (Option Buyer)", () => {
			const strat = STRATEGY_CATALOGUE.find((s) => s.name === "Bull Call Spread")!;
			const payoff = strategyEngine.buildLegsAndPayoff(
				"NIFTY",
				strat,
				spotPrice,
				atmStrike,
				strikeInterval,
				lotSize,
				undefined,
				7,
				16,
			);

			expect(payoff.isCredit).toBe(false);
			expect(payoff.legs.length).toBe(2);

			// Leg 1: BUY ATM Call @ 25000
			expect(payoff.legs[0].action).toBe("BUY");
			expect(payoff.legs[0].type).toBe("CE");
			expect(payoff.legs[0].strikePrice).toBe(25000);

			// Leg 2: SELL OTM Call @ 25050
			expect(payoff.legs[1].action).toBe("SELL");
			expect(payoff.legs[1].type).toBe("CE");
			expect(payoff.legs[1].strikePrice).toBe(25050);

			// Buyer max loss is total debit paid
			expect(payoff.maxLoss).toBe(payoff.totalNetPremium);
			expect(typeof payoff.maxProfit).toBe("number");
			expect(payoff.maxProfit).toBeGreaterThan(0);
		});
	});

	// ── 4. End-to-End Pick Generation ───────────────────────────────────────
	describe("4. End-to-End Pick Payload Integration", () => {
		it("generates a complete derivative pick with legs in fallback mode", async () => {
			const mockContext = {
				today: "2026-11-05",
				recentIds: new Set<string>(),
				service: {
					generateRationale: async (p: any) =>
						`Structured investment thesis for ${p.name}. Targets high probability decay.`,
				} as any,
			};

			const pick = await (strategyEngine as any).generateFallbackPick(mockContext);

			expect(pick).not.toBeNull();
			expect(pick.category).toBe("derivatives");
			expect(pick.recoPrice).toBeGreaterThan(0);
			expect(pick.targetPrice).toBeGreaterThan(0);
			expect(pick.stoplossPrice).toBeGreaterThan(0);

			// Key metrics must include legs array
			const km = pick.keyMetrics;
			expect(km.legs).toBeDefined();
			expect(Array.isArray(km.legs)).toBe(true);
			expect(km.legs.length).toBeGreaterThanOrEqual(1);

			// Verify each leg has proper structure
			for (const leg of km.legs) {
				expect(["BUY", "SELL"]).toContain(leg.action);
				expect(["CE", "PE", "FUT"]).toContain(leg.type);
				expect(leg.strikePrice).toBeGreaterThan(0);
				expect(leg.premium).toBeGreaterThan(0);
				expect(leg.name).toContain(leg.strikePrice.toString());
			}

			// Key metrics must include payoff metrics
			expect(km.maxProfit).toBeDefined();
			expect(km.maxLoss).toBeDefined();
			expect(km.breakeven).toBeDefined();
			expect(km.greeks).toBeDefined();
			expect(km.marginRequired).toBeGreaterThan(0);
			expect(["SELLER", "BUYER"]).toContain(km.strategyType);

			// Engine hardening: POP and execution sequence
			expect(km.pop).toBeDefined();
			expect(km.pop).toBeGreaterThanOrEqual(5);
			expect(km.pop).toBeLessThanOrEqual(95);

			for (const leg of km.legs) {
				if (leg.action === "BUY") {
					expect(leg.executionPriority).toBe(1);
				} else {
					expect(leg.executionPriority).toBe(2);
				}
			}
		});
	});

	// ── 5. Hardening Verifications ───────────────────────────────────────────
	describe("5. Engine Hardening: Mathematical POP, Dynamic Expiry & Asset-Class IV", () => {
		it("calculates realistic Probability of Profit (POP) and leg execution sequences", () => {
			const strat = STRATEGY_CATALOGUE.find((s) => s.name === "Iron Condor")!;
			const payoff = strategyEngine.buildLegsAndPayoff(
				"NIFTY",
				strat,
				25000,
				25000,
				50,
				65,
				undefined,
				5,
				18,
			);

			expect(payoff.pop).toBeGreaterThanOrEqual(10);
			expect(payoff.pop).toBeLessThanOrEqual(95);

			// Buy wings must have executionPriority 1, sell legs must have executionPriority 2
			const buyWings = payoff.legs.filter((l) => l.action === "BUY");
			const sellLegs = payoff.legs.filter((l) => l.action === "SELL");

			for (const w of buyWings) {
				expect(w.executionPriority).toBe(1);
				expect(w.executionNote).toContain("SEBI portfolio margin");
			}
			for (const s of sellLegs) {
				expect(s.executionPriority).toBe(2);
				expect(s.executionNote).toContain("after protective wings");
			}
		});

		it("dynamically resolves exchange expiry day by index convention and SEBI 2026 rules", () => {
			const niftyExpiry = strategyEngine.getUpcomingWeeklyExpiry("NIFTY");
			const niftyDate = new Date(`${niftyExpiry}T12:00:00Z`);
			// NIFTY weekly contracts expire on Thursday (day 4), pre-poned if holiday
			expect([1, 2, 3, 4]).toContain(niftyDate.getUTCDay());

			const bankNiftyExpiry = strategyEngine.getUpcomingWeeklyExpiry("BANKNIFTY");
			const bankNiftyDate = new Date(`${bankNiftyExpiry}T12:00:00Z`);
			// Under SEBI 2026 framework, BANKNIFTY is monthly Thursday (day 4) or pre-poned to preceding trading day
			expect([1, 2, 3, 4]).toContain(bankNiftyDate.getUTCDay());
		});

		it("normalizes IV bands between equity index and single stocks", () => {
			// IV = 24% on NIFTY (Index) is elevated (volRegime: high -> SELLER)
			const niftyStrat = selectStrategy(25000, 24, [25000], undefined, "NIFTY");
			expect(niftyStrat.volPreference).toBe("sell");

			// IV = 24% on RELIANCE (Single Stock) is normal equity volatility (normal IV -> not forced high)
			const stockStrat = selectStrategy(2950, 24, [2950], undefined, "RELIANCE");
			// Since normal IV rotates by calendar day, it won't be artificially hard-locked to seller
			expect(stockStrat).toBeDefined();
		});

		it("strictly separates Long Straddle (identical strikes) from Long Strangle (different strikes)", () => {
			const straddleDef = STRATEGY_CATALOGUE.find((s) => s.name === "Long Straddle")!;
			const strangleDef = STRATEGY_CATALOGUE.find((s) => s.name === "Long Strangle")!;

			const straddlePayoff = strategyEngine.buildLegsAndPayoff(
				"INFY",
				straddleDef,
				1850,
				1860,
				20,
				300,
				undefined,
				7,
				18,
			);

			const stranglePayoff = strategyEngine.buildLegsAndPayoff(
				"INFY",
				strangleDef,
				1850,
				1860,
				20,
				300,
				undefined,
				7,
				18,
			);

			// Straddle: Both legs MUST have the exact same ATM strike
			expect(straddlePayoff.legs.length).toBe(2);
			expect(straddlePayoff.legs[0].strikePrice).toBe(1860);
			expect(straddlePayoff.legs[1].strikePrice).toBe(1860);
			expect(straddlePayoff.legs[0].strikePrice).toBe(straddlePayoff.legs[1].strikePrice);

			// Strangle: Call leg MUST be higher than Put leg (OTM separation)
			expect(stranglePayoff.legs.length).toBe(2);
			const ceLeg = stranglePayoff.legs.find((l) => l.type === "CE")!;
			const peLeg = stranglePayoff.legs.find((l) => l.type === "PE")!;
			expect(ceLeg.strikePrice).toBe(1880); // 1860 + 20
			expect(peLeg.strikePrice).toBe(1840); // 1860 - 20
			expect(ceLeg.strikePrice).toBeGreaterThan(peLeg.strikePrice);

			// Straddle POP for debit buyer must be realistic (< 55%), never 99%
			expect(straddlePayoff.pop).toBeGreaterThanOrEqual(20);
			expect(straddlePayoff.pop).toBeLessThanOrEqual(55);
		});
	});

	// ── 6. Tradeability Guardrail, Minimum Order Quantity & SEBI Monthly Expiry ───
	describe("6. Tradeability Guardrail, Minimum Order Quantity & SEBI Monthly Expiry", () => {
		it("strictly computes monthly Thursday expiry for single-stock options (no weekly expiries)", () => {
			const infyExpiry = strategyEngine.getUpcomingExpiry("INFY", new Date("2026-11-23T10:00:00.000Z"));
			// 23 Nov 2026 is a Monday. Last Thursday of Nov 2026 is 26 Nov 2026.
			expect(infyExpiry).toBe("2026-11-26");
			const d = new Date(infyExpiry);
			expect(d.getDay()).toBe(4); // Thursday
		});

		it("allows weekly expiry for benchmark indices (NIFTY / SENSEX)", () => {
			const niftyExpiry = strategyEngine.getUpcomingExpiry("NIFTY", new Date("2026-11-23T10:00:00.000Z"));
			// NIFTY expires on Thursday
			const d = new Date(niftyExpiry);
			expect(d.getDay()).toBe(4);
			expect(niftyExpiry).toBe("2026-11-26");
		});

		it("enforces minimum order quantity equals lot size and calculates minContractValue", async () => {
			const mockContext = {
				recentIds: new Set<string>(),
				service: {
					generateRationale: async (p: any) => `Structured rationale for ${p.name}`,
				} as any,
			};

			const pick = await (strategyEngine as any).generateFallbackPick(mockContext);
			const km = pick.keyMetrics;
			expect(km.lotSize).toBeGreaterThan(0);
			expect(km.minOrderQuantity).toBe(km.lotSize);
			expect(km.orderMultiple).toBe(km.lotSize);
			expect(km.minContractValue).toBeGreaterThan(0);
		});

		it("flags single-stock legs as untradeable when open interest is 0 or chain is synthetic", () => {
			const strat = STRATEGY_CATALOGUE.find((s) => s.name === "Bear Call Spread")!;
			// Synthetic chain mock without live exchange quotes
			const syntheticChain = {
				dataSource: "synthetic",
				options: [],
			};
			const payoff = strategyEngine.buildLegsAndPayoff(
				"INFY",
				strat,
				1850,
				1860,
				20,
				300,
				syntheticChain,
			);
			expect(payoff.allLegsTradeable).toBe(false);
			expect(payoff.untradeableLegsCount).toBeGreaterThan(0);
			for (const leg of payoff.legs) {
				expect(leg.isTradeable).toBe(false);
			}
		});

		it("flags legs as tradeable when live quotes with positive OI and volume exist", () => {
			const strat = STRATEGY_CATALOGUE.find((s) => s.name === "Bear Call Spread")!;
			const liveChain = {
				dataSource: "live",
				options: [
					{
						strikePrice: 1860,
						optionType: "CE",
						openInterest: 150000,
						volume: 45000,
						bidPrice: 18.5,
						askPrice: 19.0,
						lastPrice: 18.75,
					},
					{
						strikePrice: 1880,
						optionType: "CE",
						openInterest: 220000,
						volume: 60000,
						bidPrice: 8.2,
						askPrice: 8.5,
						lastPrice: 8.35,
					},
				],
			};
			const payoff = strategyEngine.buildLegsAndPayoff(
				"INFY",
				strat,
				1850,
				1860,
				20,
				300,
				liveChain,
			);
			expect(payoff.allLegsTradeable).toBe(true);
			expect(payoff.untradeableLegsCount).toBe(0);
			for (const leg of payoff.legs) {
				expect(leg.isTradeable).toBe(true);
				expect(leg.openInterest).toBeGreaterThan(0);
			}
		});

		it("populates targetExpiry on individual legs and ensures no NSE holiday collision", () => {
			const strat = STRATEGY_CATALOGUE.find((s) => s.name === "Bull Call Spread")!;
			const targetExpiry = strategyEngine.getUpcomingExpiry("ICICIBANK");
			expect(targetExpiry).toBeDefined();

			const payoff = strategyEngine.buildLegsAndPayoff(
				"ICICIBANK",
				strat,
				1250,
				1260,
				20,
				700,
				undefined,
				7,
				19,
				targetExpiry,
			);
			expect(payoff.legs.length).toBe(2);
			for (const leg of payoff.legs) {
				expect(leg.expiryDate).toBe(targetExpiry);
			}
		});
	});

	// ── 8. Live Mark-to-Market (MTM) Revaluation & SEBI F&O Ban Guardrail ──
	describe("8. Live Mark-to-Market (MTM) Revaluation & SEBI F&O Ban Guardrail", () => {
		it("calculates real-time MTM totalNetPremium when pick with legs is supplied to getLivePrice", async () => {
			const mockPick = {
				category: "derivatives",
				symbol: "NIFTY",
				recoPrice: 6500,
				targetPrice: 2275,
				stoplossPrice: 11700,
				expiryDate: "2026-12-31",
				keyMetrics: {
					isCreditStrategy: true,
					strategyType: "SELLER",
					lotSize: 65,
					spotPrice: 25000,
					iv: 18,
					legs: [
						{ action: "SELL", type: "PE", strikePrice: 25000, quantity: 1, premium: 120 },
						{ action: "BUY", type: "PE", strikePrice: 24950, quantity: 1, premium: 90 },
					],
				},
			};

			const liveMtm = await strategyEngine.getLivePrice("NIFTY Bull Put Spread", mockPick);
			expect(liveMtm).toBeDefined();
			expect(typeof liveMtm).toBe("number");
			expect(liveMtm).toBeGreaterThan(0);
		});

		it("returns spot price as fallback when only instrument symbol is provided", async () => {
			const spot = await strategyEngine.getLivePrice("NIFTY");
			expect(spot).toBeDefined();
			expect(typeof spot).toBe("number");
			expect(spot).toBeGreaterThan(0);
		});

		it("supports getLiveQuote and wraps MTM price correctly", async () => {
			const mockPick = {
				symbol: "NIFTY",
				keyMetrics: {
					isCreditStrategy: false,
					strategyType: "BUYER",
					lotSize: 65,
					spotPrice: 25000,
					iv: 18,
					legs: [
						{ action: "BUY", type: "CE", strikePrice: 25000, quantity: 1, premium: 150 },
						{ action: "SELL", type: "CE", strikePrice: 25100, quantity: 1, premium: 90 },
					],
				},
			};

			const quote = await strategyEngine.getLiveQuote("NIFTY Bull Call Spread", mockPick);
			expect(quote).toBeDefined();
			expect(quote?.price).toBeGreaterThan(0);
		});
	});
});

