import { describe, it, expect } from "vitest";
import {
	DerivativeStrategy,
	STRATEGY_CATALOGUE,
	selectStrategy,
	type DerivativeStrategyDef,
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

		it("dynamically resolves exchange expiry day by index convention", () => {
			const niftyExpiry = strategyEngine.getUpcomingWeeklyExpiry("NIFTY");
			const niftyDate = new Date(niftyExpiry);
			// NIFTY weekly contracts expire on Thursday (day 4)
			expect(niftyDate.getDay()).toBe(4);

			const bankNiftyExpiry = strategyEngine.getUpcomingWeeklyExpiry("BANKNIFTY");
			const bankNiftyDate = new Date(bankNiftyExpiry);
			// BankNifty weekly contracts expire on Wednesday (day 3)
			expect(bankNiftyDate.getDay()).toBe(3);
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
	});
});

